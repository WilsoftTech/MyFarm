import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { mkdirSync } from "node:fs";
import { z } from "zod";
import { readProductionBrowserFixtures } from "../support/production-browser-fixtures";

test("AC001: two farms retain multi-enterprise, multi-season histories and separate quantities after retries", async ({ page, context }, info) => {
  const fixtures = readProductionBrowserFixtures();
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    for (const table of ["CropCycle", "PoultryBatch", "Enterprise", "Season", "Plot"]) {
      await db.query(`DELETE FROM "${table}" WHERE "tenantId"=ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
    }
    await db.query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
    await db.query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
    await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
    const headers = { origin: "http://127.0.0.1:3102" };
    const post = async (farm: string, resource: string, data: Record<string, unknown>) => {
      const response = await context.request.post(`/api/v1/farms/${farm}/${resource}`, { headers, data });
      expect(response.status()).toBe(201);
      return response.json();
    };
    const create = async (farm: string) => {
      const enterprise = async (name: string, type: "CROP" | "POULTRY") => z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await post(farm, "enterprises", { requestId: crypto.randomUUID(), name, type })).enterprise.enterpriseId;
      const season = async (label: string) => z.object({ season: z.object({ seasonId: z.uuid() }) }).parse(await post(farm, "seasons", { requestId: crypto.randomUUID(), label, startDate: "2026-03-01" })).season.seasonId;
      return {
        farm, crop: await enterprise("Annual crops", "CROP"), perennial: await enterprise("Perennial crops", "CROP"), poultry: await enterprise("Layers", "POULTRY"),
        first: await season("First season"), second: await season("Overlapping season"),
        plot: z.object({ plotId: z.uuid() }).parse(await post(farm, "plots", { requestId: crypto.randomUUID(), name: "Production plot", area: "1", areaUnit: "ACRE" })).plotId,
      };
    };
    const a = await create(fixtures.farms.a), b = await create(fixtures.farms.a2);
    const cycle = async (parents: typeof a, enterpriseId: string, seasonId: string, cropId: string, areaPlanted: string, variety: string) => {
      const command = { requestId: crypto.randomUUID(), enterpriseId, seasonId, plotId: parents.plot, cropId, areaPlanted, areaUnit: "ACRE", plantingDate: "2026-03-01", variety };
      const original = await post(parents.farm, "crop-cycles", command);
      expect(await post(parents.farm, "crop-cycles", command)).toEqual(original);
      return { id: z.object({ cycle: z.object({ cycleId: z.uuid() }) }).parse(original).cycle.cycleId, command };
    };
    const crops = z.array(z.object({ id: z.uuid(), name: z.string() })).parse((await db.query('SELECT id,name FROM "CropCatalog" WHERE name IN (\'Maize\',\'Coffee\')')).rows);
    const cropId = (name: string) => { const row = crops.find(crop => crop.name === name); if (!row) throw new Error("Missing reference crop"); return row.id; };
    const first = await cycle(a, a.crop, a.first, cropId("Maize"), "0.1", "Farm A first");
    await cycle(a, a.crop, a.second, cropId("Maize"), "0.2", "Farm A second");
    await cycle(a, a.perennial, a.second, cropId("Coffee"), "0.3", "Farm A perennial");
    await cycle(b, b.crop, b.first, cropId("Maize"), "0.4", "Farm B annual");
    await cycle(b, b.perennial, b.second, cropId("Coffee"), "0.5", "Farm B perennial");
    const batch = async (parents: typeof a, label: string, startingQuantity: number) => {
      const command = { requestId: crypto.randomUUID(), enterpriseId: parents.poultry, animalTypeId: "f4030008-0000-4000-8000-000000000004", batchLabel: label, startingQuantity, acquisitionDate: "2026-03-01", purpose: "EGGS" };
      const original = await post(parents.farm, "poultry-batches", command);
      expect(await post(parents.farm, "poultry-batches", command)).toEqual(original);
    };
    await batch(a, "Shared label", 100); await batch(a, "Second flock", 25); await batch(b, "Shared label", 7);
    // A rejected same-owner, wrong-farm parent must leave no record or receipt.
    const invalid = { ...first.command, requestId: crypto.randomUUID(), seasonId: b.first };
    expect((await context.request.post(`/api/v1/farms/${a.farm}/crop-cycles`, { headers, data: invalid })).status()).toBe(403);
    expect((await db.query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId"=$1', [invalid.requestId])).rows).toEqual([{ n: 0 }]);
    expect((await context.request.get(`/api/v1/farms/${b.farm}/crop-cycles/${first.id}`)).status()).toBe(403);
    for (const [parents, cropCount, batchCount, names] of [[a, 3, 2, ["Farm A first", "Farm A second", "Farm A perennial"]], [b, 2, 1, ["Farm B annual", "Farm B perennial"]]] as const) {
      await page.goto(`/farms/${parents.farm}/crop-cycles`);
      const cycles = page.getByRole("list", { name: "Crop cycles on this farm" });
      await expect(cycles.getByRole("listitem")).toHaveCount(cropCount);
      for (const name of names) await expect(cycles.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
      await page.reload(); await expect(cycles.getByRole("listitem")).toHaveCount(cropCount);
      await page.goto(`/farms/${parents.farm}/poultry-batches`);
      await expect(page.getByRole("list", { name: "Poultry batches on this farm" }).getByRole("listitem")).toHaveCount(batchCount);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    // Exact, unit-qualified source totals: no floating point or crop/poultry join multiplication.
    expect((await db.query('SELECT "farmId", "areaUnit", sum("areaPlanted")::text AS area, count(*)::int AS cycles FROM "CropCycle" WHERE "farmId"=ANY($1::uuid[]) GROUP BY "farmId","areaUnit" ORDER BY "farmId"', [[a.farm, b.farm]])).rows).toEqual([
      { farmId: a.farm, areaUnit: "ACRE", area: "0.600000", cycles: 3 }, { farmId: b.farm, areaUnit: "ACRE", area: "0.900000", cycles: 2 },
    ].sort((left, right) => left.farmId.localeCompare(right.farmId)));
    expect((await db.query('SELECT "farmId", sum("startingQuantity")::text AS birds, count(*)::int AS batches FROM "PoultryBatch" WHERE "farmId"=ANY($1::uuid[]) GROUP BY "farmId" ORDER BY "farmId"', [[a.farm, b.farm]])).rows).toEqual([
      { farmId: a.farm, birds: "125", batches: 2 }, { farmId: b.farm, birds: "7", batches: 1 },
    ].sort((left, right) => left.farmId.localeCompare(right.farmId)));
    expect((await db.query('SELECT "seasonId", sum("areaPlanted")::text AS area FROM "CropCycle" WHERE "farmId"=ANY($1::uuid[]) GROUP BY "seasonId" ORDER BY "seasonId"', [[a.farm, b.farm]])).rows).toEqual([
      { seasonId: a.first, area: "0.100000" }, { seasonId: a.second, area: "0.500000" }, { seasonId: b.first, area: "0.400000" }, { seasonId: b.second, area: "0.500000" },
    ].sort((left, right) => left.seasonId.localeCompare(right.seasonId)));
    await context.clearCookies();
    await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts.b.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
    expect((await context.request.get(`/api/v1/farms/${a.farm}/crop-cycles`)).status()).toBe(403);
    expect((await context.request.get(`/api/v1/farms/${b.farm}/poultry-batches`)).status()).toBe(403);
    const deniedClose = await context.request.post(`/api/v1/farms/${a.farm}/crop-cycles/${first.id}/close`, { headers, data: { requestId: crypto.randomUUID(), expectedVersion: 1, confirmed: true } });
    expect(deniedClose.status()).toBe(403);
    await context.clearCookies();
    await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
    await page.goto(`/farms/${a.farm}/seasons/${a.first}`);
    const confirm = page.getByRole("checkbox", { name: "I understand that closing is final." });
    await expect(page.getByRole("button", { name: "Close season", exact: true })).toBeDisabled();
    await confirm.check(); await page.getByRole("button", { name: "Close season", exact: true }).click();
    await expect(page.getByRole("form", { name: "Close season" }).getByRole("alert")).toContainText("Close every active crop cycle");
    mkdirSync(".cache/t013-visual", { recursive: true });
    await page.screenshot({ path: `.cache/t013-visual/closure-confirmation-${info.project.name}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto(`/farms/${a.farm}/crop-cycles/${first.id}`);
    await page.getByRole("checkbox", { name: "I understand that closing is final." }).check();
    await page.getByRole("button", { name: "Close crop cycle", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Crop cycle closed.");
    await expect(page.getByRole("button", { name: "Close crop cycle", exact: true })).toHaveCount(0);
    await page.goto(`/farms/${a.farm}/seasons/${a.first}`);
    await page.getByRole("checkbox", { name: "I understand that closing is final." }).check();
    await page.getByRole("button", { name: "Close season", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Season closed.");
    await expect(page.getByRole("button", { name: "Close season", exact: true })).toHaveCount(0);
    await page.screenshot({ path: `.cache/t013-visual/closed-season-${info.project.name}.png`, fullPage: true });
    await page.reload(); await expect(page.getByRole("status")).toHaveText("Season closed.");
    await page.goto(`/farms/${a.farm}/crop-cycles`);
    await expect(page.getByRole("list", { name: "Crop cycles on this farm" }).getByRole("listitem")).toHaveCount(3);
    expect((await db.query('SELECT status,version FROM "Season" WHERE id=$1', [a.first])).rows).toEqual([{ status: "CLOSED", version: 2 }]);
    expect((await db.query('SELECT action,count(*)::int AS n FROM "AuditEvent" WHERE "targetId"=ANY($1::uuid[]) AND action IN (\'SEASON_CLOSED\',\'CROP_CYCLE_CLOSED\') GROUP BY action ORDER BY action', [[a.first, first.id]])).rows).toEqual([{ action: "CROP_CYCLE_CLOSED", n: 1 }, { action: "SEASON_CLOSED", n: 1 }]);
  } finally { await db.end(); }
});
