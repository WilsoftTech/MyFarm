import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
async function setup(context: BrowserContext, farm = fixtures.farms.a, name = "Main crop") {
  const headers = { origin: "http://127.0.0.1:3102" }, request = context.request;
  const enterprise = await request.post(`/api/v1/farms/${farm}/enterprises`, { headers, data: { requestId: id(), name, type: "CROP" } }); expect(enterprise.status()).toBe(201);
  const enterpriseId = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await enterprise.json()).enterprise.enterpriseId;
  const season = await request.post(`/api/v1/farms/${farm}/seasons`, { headers, data: { requestId: id(), label: "Season A", startDate: "2026-03-01" } }); expect(season.status()).toBe(201);
  const seasonId = z.object({ season: z.object({ seasonId: z.uuid() }) }).parse(await season.json()).season.seasonId;
  const plot = await request.post(`/api/v1/farms/${farm}/plots`, { headers, data: { requestId: id(), name: "North plot", area: "1", areaUnit: "ACRE" } }); expect(plot.status()).toBe(201);
  const plotId = z.object({ plotId: z.uuid() }).parse(await plot.json()).plotId;
  return { enterpriseId, seasonId, plotId, farm };
}
async function fill(page: Page, parents: Awaited<ReturnType<typeof setup>>, area = "0.1", crop = "Maize") {
  await page.getByLabel("Enterprise", { exact: true }).selectOption(parents.enterpriseId);
  await page.getByLabel("Season", { exact: true }).selectOption(parents.seasonId);
  await page.getByLabel("Plot", { exact: true }).selectOption(parents.plotId);
  await page.getByLabel("Crop", { exact: true }).selectOption({ label: crop });
  await page.getByLabel("Area planted", { exact: true }).fill(area);
  await page.getByLabel("Planting date", { exact: true }).fill("2026-03-01");
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Save crop cycle" }).click();
  await expect(page.getByRole("status")).toHaveText("Crop cycle saved.");
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  for (const table of ["CropCycle", "Enterprise", "Season", "Plot"]) await query(`DELETE FROM "${table}" WHERE "tenantId"=ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "a");
});
test("empty/setup states → planting with dates/units → perennial → separate farm histories", async ({ page, context }, info) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}`); await page.getByRole("link", { name: "Crop cycles", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No crop cycles yet" })).toBeVisible();
  await page.getByRole("link", { name: "Start crop cycle" }).click();
  await expect(page.getByRole("heading", { name: "Set up this farm before planting" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add enterprise" })).toHaveAttribute("href", `/farms/${farm}/enterprises/new`);
  const parents = await setup(context);
  await page.goto(`/farms/${farm}/enterprises/${parents.enterpriseId}`);
  await page.getByRole("link", { name: "Start crop cycle" }).click();
  await expect(page.getByLabel("Enterprise", { exact: true })).toHaveValue(parents.enterpriseId);
  await page.getByRole("button", { name: "Save crop cycle" }).click();
  await expect(page.getByLabel("Season", { exact: true })).toBeFocused();
  await fill(page, parents, "0.4");
  await page.getByLabel("Expected harvest date (optional)").fill("2026-02-28");
  await page.getByRole("button", { name: "Save crop cycle" }).click();
  await expect(page.getByText("The expected harvest must be on or after the planting date.")).toBeVisible();
  await page.getByLabel("Expected harvest date (optional)").fill("2026-08-01");
  await expect(page.getByLabel("Area unit", { exact: true })).toHaveValue("Acres");
  mkdirSync(".cache/t006-visual", { recursive: true });
  await page.screenshot({ path: `.cache/t006-visual/crop-form-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await save(page);
  await expect(page.getByRole("heading", { name: "Maize crop cycle" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Main crop", exact: true })).toHaveAttribute("href", `/farms/${farm}/enterprises/${parents.enterpriseId}`);
  await expect(page.getByText("0.4 Acres", { exact: true })).toBeVisible(); await expect(page.getByText("North plot", { exact: true })).toBeVisible();
  await page.screenshot({ path: `.cache/t006-visual/crop-detail-${info.project.name}.png`, fullPage: true });
  await page.goto(`/farms/${farm}/crop-cycles/new`); await fill(page, parents, "0.2", "Coffee"); await save(page);
  await expect(page.getByText("Not recorded — open-ended cycle", { exact: true })).toBeVisible();
  const other = await setup(context, fixtures.farms.a2, "Second farm crop");
  await page.goto(`/farms/${other.farm}/crop-cycles/new`); await fill(page, other, "1"); await save(page);
  await page.goto(`/farms/${farm}/crop-cycles`); await expect(page.getByRole("list", { name: "Crop cycles on this farm" }).getByRole("listitem")).toHaveCount(2);
  await page.goto(`/farms/${other.farm}/crop-cycles`); await expect(page.getByRole("list", { name: "Crop cycles on this farm" }).getByRole("listitem")).toHaveCount(1);
});
test("excess area fails without an effect, retains draft, then records the explicit reason", async ({ page, context }) => {
  const parents = await setup(context), path = `/farms/${parents.farm}/crop-cycles/new`;
  await page.goto(path); await fill(page, parents, "0.8"); await save(page);
  await page.goto(path); await fill(page, parents, "0.3"); await page.getByRole("button", { name: "Save crop cycle" }).click();
  await expect(page.locator("form[aria-busy]").getByRole("alert")).toContainText("record a reason");
  await expect(page.getByLabel("Area planted", { exact: true })).toHaveValue("0.3");
  expect((await query('SELECT count(*)::int AS n FROM "CropCycle" WHERE "plotId"=$1', [parents.plotId])).rows[0].n).toBe(1);
  await page.getByLabel("Reason for extra planted area (optional)").fill("Owner records overlapping intercropping"); await save(page);
  await expect(page.getByText("Owner records overlapping intercropping", { exact: true })).toBeVisible();
  expect((await query('SELECT count(*)::int AS n FROM "CropCycle" WHERE "plotId"=$1', [parents.plotId])).rows[0].n).toBe(2);
});
test("offline open form reconnects without losing details or creating duplicate cycles", async ({ page, context }) => {
  const parents = await setup(context);
  await page.goto(`/farms/${parents.farm}/crop-cycles/new`); await fill(page, parents);
  await context.setOffline(true);
  try { await expect(page.getByRole("button", { name: "Save crop cycle" })).toBeDisabled(); await expect(page.getByText(/Keep this page open/)).toBeVisible(); await expect(page.getByLabel("Area planted", { exact: true })).toHaveValue("0.1"); }
  finally { await context.setOffline(false); }
  await save(page); expect((await query('SELECT count(*)::int AS n FROM "CropCycle" WHERE "plotId"=$1', [parents.plotId])).rows[0].n).toBe(1);
});
test("lost response after committing a crop retries exactly once with its original request identity", async ({ page, context }) => {
  const parents = await setup(context), path = `/farms/${parents.farm}/crop-cycles/new`;
  await page.goto(path); await fill(page, parents);
  let interrupted = false;
  await page.route("**/crop-cycles/new", async route => {
    if (route.request().method() === "POST" && !interrupted) { interrupted = true; await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Save crop cycle" }).click();
  await expect(page.locator("form[aria-busy]").getByRole("alert")).toContainText("Connection interrupted");
  await save(page);
  const rows = (await query('SELECT id FROM "CropCycle" WHERE "plotId"=$1', [parents.plotId])).rows; expect(rows).toHaveLength(1);
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "targetId"=$1 AND action=\'CROP_CYCLE_STARTED\'', [rows[0].id])).rows[0].n).toBe(1);
});
test("nested farm links, foreign presets and other users deny access; revocation retains an unsaved draft", async ({ page, context }) => {
  const parents = await setup(context); await page.goto(`/farms/${parents.farm}/crop-cycles/new`); await fill(page, parents); await save(page);
  const detail = new URL(page.url()).pathname, cycleId = detail.split("/").at(-1);
  await page.goto(`/farms/${fixtures.farms.a2}/crop-cycles/${cycleId}`); await expect(page).toHaveURL(/\/forbidden$/);
  await page.goto(`/farms/${fixtures.farms.a2}/crop-cycles/new?enterpriseId=${parents.enterpriseId}`); await expect(page).toHaveURL(/\/forbidden$/);
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const path of [`/farms/${parents.farm}/crop-cycles`, `/farms/${parents.farm}/crop-cycles/new`, detail]) { await page.goto(path); await expect(page).toHaveURL(/\/forbidden$/); }
  }
  await identity(context, "a"); await page.goto(`/farms/${parents.farm}/crop-cycles/new`); await fill(page, parents);
  await query('UPDATE "FarmMember" SET status=\'REVOKED\' WHERE "farmId"=$1 AND "userId"=$2', [parents.farm, fixtures.users.a]);
  try { await page.getByRole("button", { name: "Save crop cycle" }).click(); await expect(page.locator("form[aria-busy]").getByRole("alert")).toContainText("You do not have access"); await expect(page.getByLabel("Area planted", { exact: true })).toHaveValue("0.1"); }
  finally { await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "farmId"=$1 AND "userId"=$2', [parents.farm, fixtures.users.a]); }
  expect((await query('SELECT count(*)::int AS n FROM "CropCycle" WHERE "plotId"=$1', [parents.plotId])).rows[0].n).toBe(1);
});
test("provider failures remain errors, recover with retry, and never imply a saved record", async ({ page, context }) => {
  const parents = await setup(context), path = `/farms/${parents.farm}/crop-cycles/new`;
  await query('REVOKE SELECT ON "CropCatalog" FROM myfarm_runtime');
  try { await page.goto(path); await expect(page.getByRole("heading", { name: "We could not load this page" })).toBeVisible(); await expect(page.getByText("No crops are available to choose.", { exact: false })).toHaveCount(0); }
  finally { await query('GRANT SELECT ON "CropCatalog" TO myfarm_runtime'); }
  await page.getByRole("button", { name: "Try again" }).click(); await expect(page.getByLabel("Enterprise", { exact: true })).toBeVisible(); await fill(page, parents);
  await query('REVOKE INSERT ON "CropCycle" FROM myfarm_runtime');
  try {
    await page.getByRole("button", { name: "Save crop cycle" }).click(); await expect(page.locator("form[aria-busy]").getByRole("alert")).toContainText("MyFarm is unavailable");
    await expect(page.getByLabel("Area planted", { exact: true })).toHaveValue("0.1"); expect((await query('SELECT count(*)::int AS n FROM "CropCycle" WHERE "plotId"=$1', [parents.plotId])).rows[0].n).toBe(0);
  } finally { await query('GRANT INSERT ON "CropCycle" TO myfarm_runtime'); }
  await save(page);
});
test("later parent choices preserve the draft and crop list pagination stays scoped", async ({ page, context }) => {
  const parents = await setup(context);
  for (const [table, key] of [["Enterprise", parents.enterpriseId], ["Season", parents.seasonId], ["Plot", parents.plotId]]) await query(`UPDATE "${table}" SET "createdAt"='2000-01-01' WHERE id=$1`, [key]);
  for (let n = 0; n < 21; n++) {
    await query('INSERT INTO "Enterprise" (id,"tenantId","farmId",name,type,"createdBy") VALUES ($1,$2,$3,$4,\'CROP\',$5)', [id(), fixtures.tenants.a, parents.farm, "Choice enterprise " + n, fixtures.users.a]);
    await query('INSERT INTO "Season" (id,"tenantId","farmId",label,"startDate","createdBy") VALUES ($1,$2,$3,$4,\'2026-03-01\',$5)', [id(), fixtures.tenants.a, parents.farm, "Choice season " + n, fixtures.users.a]);
    await query('INSERT INTO "Plot" (id,"tenantId","farmId",name,area,"areaUnit","createdBy") VALUES ($1,$2,$3,$4,1,\'ACRE\',$5)', [id(), fixtures.tenants.a, parents.farm, "Choice plot " + n, fixtures.users.a]);
  }
  await page.goto(`/farms/${parents.farm}/crop-cycles/new`); await page.getByLabel("Variety (optional)").fill("Draft retained");
  for (const label of ["enterprise", "season", "plot"]) { await page.getByRole("button", { name: "More " + label + " choices" }).click(); await expect(page.getByRole("button", { name: "More " + label + " choices" })).toHaveCount(0); }
  await expect(page.getByLabel("Variety (optional)")).toHaveValue("Draft retained"); await fill(page, parents); await save(page);
  for (let n = 0; n < 20; n++) await query('INSERT INTO "CropCycle" (id,"tenantId","farmId","enterpriseId","seasonId","plotId","cropId","cropName",variety,"areaPlanted","areaUnit","plantingDate","createdBy") VALUES ($1,$2,$3,$4,$5,$6,\'f4030005-0000-4000-8000-000000000001\',\'Maize\',$7,0.000001,\'ACRE\',\'2026-03-01\',$8)', [id(), fixtures.tenants.a, parents.farm, parents.enterpriseId, parents.seasonId, parents.plotId, "Page " + n, fixtures.users.a]);
  await query('UPDATE "CropCycle" SET "createdAt"=\'2026-03-01\' WHERE "farmId"=$1', [parents.farm]);
  await page.goto(`/farms/${parents.farm}/crop-cycles`); await expect(page.getByRole("list", { name: "Crop cycles on this farm" }).getByRole("listitem")).toHaveCount(20);
  await page.getByRole("link", { name: "More records" }).click(); await expect(page.getByRole("list", { name: "Crop cycles on this farm" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: "First page" }).click(); await expect(page.getByRole("list", { name: "Crop cycles on this farm" }).getByRole("listitem")).toHaveCount(20);
});
test("unknown plot area and inactive parents block setup; expired sessions cannot open it", async ({ page, context }) => {
  const parents = await setup(context);
  await query('UPDATE "Plot" SET area=NULL,"areaUnit"=NULL WHERE id=$1', [parents.plotId]);
  await query('UPDATE "Enterprise" SET status=\'CLOSED\' WHERE id=$1', [parents.enterpriseId]);
  await page.goto(`/farms/${parents.farm}/crop-cycles/new`); await expect(page.getByRole("heading", { name: "Set up this farm before planting" })).toBeVisible(); await expect(page.getByRole("link", { name: "Open farm plots" })).toBeVisible();
  await query('UPDATE auth.sessions SET not_after=now()-interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  await page.goto(`/farms/${parents.farm}/crop-cycles/new`); await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
});
