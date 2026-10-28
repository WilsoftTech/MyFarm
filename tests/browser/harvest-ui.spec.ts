import { test, expect } from "@playwright/test";
import { z } from "zod";
import { Client } from "pg";
import { readProductionBrowserFixtures } from "../support/production-browser-fixtures";

test("harvest entry preserves offline input, posts once and denies foreign farm access", async ({ page, context }) => {
  const f = readProductionBrowserFixtures(), farm = f.farms.a;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]);
  const headers = { origin: "http://127.0.0.1:3102" }, id = () => crypto.randomUUID();
  const post = async (path: string, data: object) => { const r = await context.request.post(`/api/v1/farms/${farm}/${path}`, { headers, data }); expect(r.status()).toBe(201); return r.json(); };
  try {
    const e = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await post("enterprises", { requestId: id(), name: "Harvest crop " + id(), type: "CROP" })).enterprise;
    const s = z.object({ season: z.object({ seasonId: z.uuid() }) }).parse(await post("seasons", { requestId: id(), label: "Harvest season " + id(), startDate: "2026-03-01" })).season;
    const p = z.object({ plotId: z.uuid() }).parse(await post("plots", { requestId: id(), name: "Harvest plot " + id(), area: "1", areaUnit: "ACRE" }));
    const c = z.object({ cycle: z.object({ cycleId: z.uuid() }) }).parse(await post("crop-cycles", { requestId: id(), enterpriseId: e.enterpriseId, seasonId: s.seasonId, plotId: p.plotId, cropId: "f4030005-0000-4000-8000-000000000001", plantingDate: "2026-03-01", areaPlanted: "1", areaUnit: "ACRE" })).cycle;
    const store = z.object({ location: z.object({ storageLocationId: z.uuid() }) }).parse(await post("storage-locations", { requestId: id(), name: "Harvest store " + id() })).location;
    await page.goto(`/farms/${farm}/harvests/new`);
    await page.getByLabel("Crop cycle", { exact: true }).selectOption(c.cycleId);
    await page.getByLabel("Store", { exact: true }).selectOption(store.storageLocationId);
    await page.getByLabel("Harvest date", { exact: true }).fill("2026-10-01");
    await page.getByLabel("Harvested kilograms", { exact: true }).fill("2400");
    await page.getByLabel("Initial loss in kilograms", { exact: true }).fill("150");
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Save harvest" })).toBeDisabled();
    await expect(page.getByLabel("Harvested kilograms", { exact: true })).toHaveValue("2400");
    await context.setOffline(false);
    await page.getByRole("button", { name: "Save harvest" }).click();
    await expect(page.getByRole("heading", { name: "Maize harvest" })).toBeVisible();
    await expect(page.getByText("2250 kg", { exact: true })).toBeVisible();
    const harvestId = page.url().split("/").pop();
    expect((await context.request.get(`/api/v1/farms/${f.farms.a2}/harvests/${harvestId}`)).status()).toBe(403);
    expect((await context.request.post(`/api/v1/farms/${farm}/harvests`, { headers, data: { requestId: id(), cropCycleId: c.cycleId, cropId: "f4030005-0000-4000-8000-000000000001", plotId: id(), storageLocationId: store.storageLocationId, harvestDate: "2026-10-01", quantity: "1", unit: "BAG" } })).status()).toBe(400);
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
    try { expect((await db.query('SELECT count(*)::int AS n FROM "StockMovement" WHERE "harvestId"=$1', [harvestId])).rows[0].n).toBe(2); }
    finally { await db.end(); }
  } finally {
    await context.setOffline(false);
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
    try { for (const table of ["StockMovement", "Harvest", "InventoryItem", "StorageLocation"]) await db.query('DELETE FROM "' + table + '" WHERE "tenantId"=$1', [f.tenants.a]); }
    finally { await db.end(); }
  }
});
