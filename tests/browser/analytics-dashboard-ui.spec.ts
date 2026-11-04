import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";
import { offlineServer } from "../support/offline-server";
import { openOffline, prepared, recordExpense } from "../support/offline-browser";
const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const seed = { fertilizer: "f4040002-0000-4000-8000-000000000111", feed: "f4040002-0000-4000-8000-000000000112", rent: "f4040002-0000-4000-8000-000000000105", cropSales: "f4040002-0000-4000-8000-000000000204", eggSales: "f4040002-0000-4000-8000-000000000202", otherIncome: "f4040002-0000-4000-8000-000000000201", maize: "f4030005-0000-4000-8000-000000000001" };
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const url = (farm: string, query = "") => `/farms/${farm}/accounting/how-the-farm-is-doing${query}`;
async function create<T extends z.ZodType>(context: BrowserContext, path: string, data: Record<string, unknown>, shape: T): Promise<z.output<T>> {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/${path}`, { headers: origin, data: { requestId: id(), ...data } });
  expect(response.status()).toBe(201);
  return shape.parse(await response.json());
}
const enterprise = async (context: BrowserContext, name: string, type: "CROP" | "POULTRY") => (await create(context, "enterprises", { name, type }, z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }))).enterprise.enterpriseId;
const season = async (context: BrowserContext, label: string, startDate = "2027-03-01") => (await create(context, "seasons", { label, startDate }, z.object({ season: z.object({ seasonId: z.uuid() }) }))).season.seasonId;
const money = (context: BrowserContext, path: string, categoryId: string, amount: string, occurredOn: string, links: Record<string, string> = {}) => create(context, "accounting/" + path, { currency: "UGX", categoryId, amount, occurredOn, ...links }, z.object({ record: z.object({ recordId: z.uuid() }) }));
async function plot(context: BrowserContext) {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/plots`, { headers: origin, data: { requestId: id(), name: "Hill " + id().slice(0, 8), area: "10", areaUnit: "ACRE" } });
  expect(response.status()).toBe(201);
  return z.object({ plotId: z.uuid() }).parse(await response.json()).plotId;
}
/** The source dashboard, P0494-P0513, with a shared rent that has no season. */
async function sourceFarm(context: BrowserContext) {
  const s2027A = await season(context, "2027A"), hill = await plot(context), maize = await enterprise(context, "Maize", "CROP"), bananas = await enterprise(context, "Bananas", "CROP"), poultry = await enterprise(context, "Poultry", "POULTRY");
  for (const enterpriseId of [maize, bananas]) await create(context, "crop-cycles", { enterpriseId, seasonId: s2027A, plotId: hill, cropId: seed.maize, areaPlanted: "1", areaUnit: "ACRE", plantingDate: "2027-03-02" }, z.object({}).loose());
  await money(context, "sales", seed.cropSales, "3800000", "2027-06-01", { enterpriseId: maize, seasonId: s2027A });
  await money(context, "expenses", seed.fertilizer, "2100000", "2027-03-10", { enterpriseId: maize, seasonId: s2027A });
  await money(context, "sales", seed.eggSales, "3200000", "2027-05-01", { enterpriseId: poultry, seasonId: s2027A });
  await money(context, "purchases", seed.feed, "2400000", "2027-04-01", { enterpriseId: poultry, seasonId: s2027A });
  await money(context, "income", seed.otherIncome, "1400000", "2027-07-01", { enterpriseId: bananas, seasonId: s2027A });
  await money(context, "expenses", seed.fertilizer, "650000", "2027-03-11", { enterpriseId: bananas, seasonId: s2027A });
  await money(context, "expenses", seed.rent, "300000", "2027-04-15");
  return s2027A;
}
const figure = (page: Page, label: string) => page.locator("dt", { hasText: new RegExp("^" + label + "$") }).first().locator("+ dd");
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  await clearInventoryBrowser(fixtures);
  for (const table of ["AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "CropCycle", "PoultryBatch", "Enterprise", "Season", "Plot"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "a");
});

test("MYF-P08-AC001 the farm opens on its season and shows the source dashboard", async ({ page, context }) => {
  await sourceFarm(context);
  await page.goto(`/farms/${fixtures.farms.a}`);
  await page.getByRole("link", { name: "How the farm is doing" }).click();
  await expect(page.getByRole("heading", { name: "How the farm is doing", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Season", { exact: true })).toHaveValue(/^[0-9a-f-]{36}$/);
  await expect(page.getByText("Showing season 2027A: only records linked to it.")).toBeVisible();
  await expect(figure(page, "Money earned")).toHaveText("UGX 8,400,000");
  await expect(figure(page, "Money spent")).toHaveText("UGX 5,150,000");
  await expect(figure(page, "Recorded surplus")).toHaveText("UGX 3,250,000");
  await expect(figure(page, "Margin")).toHaveText("38.7%");
  const rows = page.getByRole("list", { name: "Enterprises in UGX" }).getByRole("listitem");
  await expect(rows.getByRole("heading")).toHaveText(["MaizeHighest", "Poultry", "Bananas"]);
  await expect(rows.nth(0)).toContainText("UGX 1,700,000"); await expect(rows.nth(1)).toContainText("UGX 800,000"); await expect(rows.nth(2)).toContainText("UGX 750,000");
  await expect(page.getByRole("region", { name: "Not linked to a season" })).toContainText("money spent UGX 300,000");
  await expect(page.getByText("it is not your full profit")).toBeVisible();
  await noSideScroll(page);
});

test("filters: all records counts the shared cost, dates narrow it, and a bad choice explains itself", async ({ page, context }) => {
  const s2027A = await sourceFarm(context), farm = fixtures.farms.a;
  await page.goto(url(farm));
  await page.getByLabel("Season", { exact: true }).selectOption({ label: "All records, or the dates below" });
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText("Showing records from every season.")).toBeVisible();
  await expect(figure(page, "Money spent")).toHaveText("UGX 5,450,000");
  await expect(figure(page, "Recorded surplus")).toHaveText("UGX 2,950,000");
  await expect(page.getByText(/Not linked to an enterprise: money earned UGX 0, money spent UGX 300,000\./)).toBeVisible();
  await expect(page.getByRole("region", { name: "Not linked to a season" })).toHaveCount(0);

  await page.getByLabel("From", { exact: true }).fill("2027-04-01"); await page.getByLabel("To", { exact: true }).fill("2027-04-30");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(figure(page, "Money spent")).toHaveText("UGX 2,700,000");
  await expect(figure(page, "Margin")).toContainText("Not available: no money earned yet.");
  await expect(page.getByLabel("Season", { exact: true })).toHaveValue("all");

  await page.getByLabel("Count money").selectOption("CASH");
  await page.getByLabel("From", { exact: true }).fill(""); await page.getByLabel("To", { exact: true }).fill("");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(figure(page, "Money earned")).toHaveText("UGX 1,400,000");
  await expect(figure(page, "Money spent")).toHaveText("UGX 3,050,000");

  await page.goto(url(farm, `?seasonId=${s2027A}&from=2027-01-01`));
  await expect(page.getByRole("form", { name: "Report filters" }).getByRole("alert")).toContainText("To use dates, choose all records");
  await page.goto(url(farm, "?seasonId=all&from=2027-02-30"));
  await expect(page.getByRole("form", { name: "Report filters" }).getByRole("alert")).toContainText("Check the dates");
  await noSideScroll(page);
});

test("an empty farm and an unlinked season each say so instead of showing zeros", async ({ page, context }) => {
  await page.goto(url(fixtures.farms.a));
  await expect(page.getByRole("heading", { name: "No money records in this view" })).toBeVisible();
  await expect(page.getByText("Figures appear here once you record money on this farm.")).toBeVisible();
  await expect(page.getByText("Recorded surplus", { exact: true })).toHaveCount(0);
  await season(context, "Empty season");
  await money(context, "expenses", seed.rent, "1000", "2027-04-15");
  await page.reload();
  await expect(page.getByText("No money record is linked to Empty season yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("region", { name: "Not linked to a season" })).toContainText("money spent UGX 1,000");
  await page.getByRole("link", { name: "Go to money records" }).click();
  await expect(page).toHaveURL(new RegExp(`/farms/${fixtures.farms.a}/accounting$`));
});

test("a reversed record leaves the figures", async ({ page, context }) => {
  const s = await season(context, "2027A");
  const wrong = await money(context, "expenses", seed.rent, "5000", "2027-04-15", { seasonId: s });
  await money(context, "expenses", seed.rent, "1000", "2027-04-16", { seasonId: s });
  await page.goto(url(fixtures.farms.a));
  await expect(figure(page, "Money spent")).toHaveText("UGX 6,000");
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/accounting/reversals`, { headers: origin, data: { requestId: id(), recordType: "EXPENSE", recordId: wrong.record.recordId, reason: "Entered twice" } });
  expect(response.status()).toBe(201);
  await page.reload();
  await expect(figure(page, "Money spent")).toHaveText("UGX 1,000");
});

test("another farmer, a guessed season, and an ended session cannot see the figures", async ({ page, context }) => {
  const s = await sourceFarm(context), farm = fixtures.farms.a;
  const api = (farmId: string, query = "") => context.request.get(`/api/v1/farms/${farmId}/profitability${query}`);
  const own = await api(farm);
  expect(own.status()).toBe(200);
  expect(z.object({ dashboard: z.object({ currencies: z.array(z.object({ recordedSurplus: z.string() })) }) }).parse(await own.json()).dashboard.currencies[0].recordedSurplus).toBe("3250000");
  expect(own.headers()["cache-control"]).toContain("no-store");
  expect((await api(farm, `?seasonId=${id()}`)).status()).toBe(403);
  expect((await api(farm, `?tenantId=${id()}`)).status()).toBe(400);

  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    expect((await api(farm)).status()).toBe(403);
    await page.goto(url(farm));
    await expect(page.getByText("UGX 8,400,000")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("How the farm is doing");
  }
  await identity(context, "b");
  expect((await api(farm, `?seasonId=${s}`)).status()).toBe(403);

  await identity(context, "a");
  await query('UPDATE "FarmMember" SET status=\'REVOKED\' WHERE "userId"=$1', [fixtures.users.a]);
  expect((await api(farm)).status()).toBe(403);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);

  await query("UPDATE auth.sessions SET not_after=now() - interval '1 hour' WHERE id=$1", [fixtures.sessions.a]);
  expect((await api(farm)).status()).toBe(401);
  await page.goto(url(farm));
  await expect(page).toHaveURL(/\/sign-in/);
});

test("D-P08-008 with no connection it points to offline work, and unsent entries count only once sent", async ({ page, context }) => {
  test.setTimeout(120_000);
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a;
  const spent = async () => {
    const response = await context.request.get(`${base}/api/v1/farms/${farm}/profitability?seasonId=all`);
    expect(response.status()).toBe(200);
    const body = z.object({ dashboard: z.object({ currencies: z.array(z.object({ expenses: z.string() })) }) }).parse(await response.json());
    return body.dashboard.currencies[0]?.expenses ?? "none";
  };
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await page.goto(base + url(farm));
    await expect(page.getByRole("heading", { name: "Offline work" })).toBeVisible();
    await expect(page.getByText("How the farm is doing needs a connection")).toBeVisible();
    await expect(page.getByText("Recorded surplus", { exact: true })).toHaveCount(0);

    await openOffline(page, base, farm);
    await recordExpense(page, "878787");
    await page.route("**/api/v1/sync/push", route => route.abort());
    await server.start();
    const before = await spent();
    expect(before).not.toContain("878787");
    await page.unroute("**/api/v1/sync/push");
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("All your entries have been sent.")).toBeVisible({ timeout: 20_000 });
    expect(BigInt(await spent()) - (before === "none" ? 0n : BigInt(before))).toBe(878787n);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

const metric = (scope: Page | ReturnType<Page["locator"]>, label: string) => scope.locator("dt", { hasText: label }).first().locator("+ dd");
const animal = "f4030008-0000-4000-8000-000000000004";
async function batch(context: BrowserContext, name: string, startingQuantity = 100) {
  const enterpriseId = await enterprise(context, name + " flock", "POULTRY");
  const created = await create(context, "poultry-batches", { enterpriseId, animalTypeId: animal, batchLabel: name, startingQuantity, acquisitionDate: "2027-03-01", purpose: "EGGS" }, z.object({ batch: z.object({ batchId: z.uuid() }) }));
  return { enterpriseId, batchId: created.batch.batchId };
}
const store = async (context: BrowserContext) => (await create(context, "storage-locations", { name: "Store " + id().slice(0, 8) }, z.object({ location: z.object({ storageLocationId: z.uuid() }) }))).location.storageLocationId;

test("MYF-P08-AC002 the approved crop and bird examples show on screen, with stock as an estimate", async ({ page, context }) => {
  const s = await season(context, "2027A"), hill = await plot(context), maize = await enterprise(context, "Maize", "CROP"), storageLocationId = await store(context);
  const cycle = await create(context, "crop-cycles", { enterpriseId: maize, seasonId: s, plotId: hill, cropId: seed.maize, areaPlanted: "3", areaUnit: "ACRE", plantingDate: "2027-03-02" }, z.object({ cycle: z.object({ cycleId: z.uuid() }) }));
  await money(context, "expenses", seed.fertilizer, "2100000", "2027-03-10", { enterpriseId: maize, seasonId: s });
  const harvest = await create(context, "harvests", { cropCycleId: cycle.cycle.cycleId, cropId: seed.maize, plotId: hill, storageLocationId, harvestDate: "2027-07-01", quantity: "4000", unit: "KG", lossQuantity: "250" }, z.object({ harvest: z.object({ itemId: z.uuid() }) }));
  const flock = await batch(context, "Batch 1");
  for (const [type, quantity] of [["PURCHASE", "5"], ["MORTALITY", "3"]]) await create(context, "poultry-production", { batchId: flock.batchId, locationId: storageLocationId, type, quantity, unit: "BIRD", occurredOn: "2027-04-01" }, z.object({}).loose());
  await money(context, "expenses", seed.feed, "525000", "2027-04-02", { batchId: flock.batchId });

  await page.goto(url(fixtures.farms.a));
  const crop = page.getByRole("list", { name: "Crop figures" }).getByRole("listitem");
  await expect(crop.getByRole("heading")).toHaveText("Maize");
  await expect(crop).toContainText("3 acres");
  await expect(crop).toContainText("So far");
  await expect(metric(crop, "Kept after loss")).toHaveText("3,750 kg");
  await expect(metric(crop, "Yield per acre")).toHaveText("1,333.33 kg");
  await expect(metric(crop, "Cost per acre")).toHaveText("UGX 700,000");
  await expect(metric(crop, "Cost per kg, the price to break even")).toHaveText("UGX 560");
  const bird = page.getByRole("list", { name: "Batch figures" }).getByRole("listitem");
  await expect(metric(bird, "Birds started")).toHaveText("105");
  await expect(metric(bird, "Mortality rate")).toHaveText("2.9%");
  await expect(metric(bird, "Cost per bird")).toHaveText("UGX 5,000");
  await expect(page.getByRole("list", { name: "Stock value" })).toContainText("Not available: not sold yet.");
  const before = await figure(page, "Recorded surplus").textContent();

  await create(context, "stock-operations", { itemId: harvest.harvest.itemId, locationId: storageLocationId, type: "SALE", quantity: "100", unit: "KG", occurredOn: "2027-08-01", reason: "Sold", sale: { categoryId: seed.cropSales, amount: "120000", currency: "UGX" } }, z.object({}).loose());
  await page.reload();
  const line = page.getByRole("list", { name: "Stock value" }).getByRole("listitem").filter({ hasText: "3,650 kg in stock" });
  await expect(metric(line, "Estimated value")).toHaveText("UGX 4,380,000");
  await expect(line).toContainText("2027-08-01");
  // Only the 120,000 sale itself moves the surplus; the unsold stock's estimate does not.
  expect(before).toBe("UGX -2,100,000");
  await expect(figure(page, "Recorded surplus")).toHaveText("UGX -1,980,000");
  await noSideScroll(page);
});

test("D-P08-010 a second crop and a date range each say why there is no per-acre figure", async ({ page, context }) => {
  const s = await season(context, "2027A"), hill = await plot(context), mixed = await enterprise(context, "Vegetables", "CROP");
  await create(context, "crop-cycles", { enterpriseId: mixed, seasonId: s, plotId: hill, cropId: seed.maize, areaPlanted: "1", areaUnit: "ACRE", plantingDate: "2027-03-02" }, z.object({}).loose());
  await money(context, "expenses", seed.fertilizer, "1000", "2027-03-10", { enterpriseId: mixed, seasonId: s });
  await page.goto(url(fixtures.farms.a));
  const crop = page.getByRole("list", { name: "Crop figures" }).getByRole("listitem");
  await expect(metric(crop, "Cost per kg, the price to break even")).toContainText("Not available: no harvest to count yet.");
  await expect(metric(crop, "Cost per acre")).toHaveText("UGX 1,000");
  await create(context, "crop-cycles", { enterpriseId: mixed, seasonId: s, plotId: hill, cropId: "f4030005-0000-4000-8000-000000000002", areaPlanted: "1", areaUnit: "ACRE", plantingDate: "2027-03-02" }, z.object({}).loose());
  await page.reload();
  await expect(metric(crop, "Cost per acre")).toContainText("Not available: this enterprise has more than one crop.");
  await expect(figure(page, "Money spent")).toHaveText("UGX 1,000");
  await page.goto(url(fixtures.farms.a, "?seasonId=all&from=2027-01-01&to=2027-12-31"));
  await expect(metric(crop, "Cost per acre")).toContainText("Not available for chosen dates.");
  await noSideScroll(page);
});

test("D-P08-003 a purchase names its batch on the form, and unlinked costs are called out", async ({ page, context }) => {
  const one = await batch(context, "Batch 1", 10), farm = fixtures.farms.a;
  await money(context, "expenses", seed.feed, "4000", "2027-04-01", { enterpriseId: one.enterpriseId });
  await page.goto(`/farms/${farm}/accounting/new/purchase`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Feed" });
  await page.getByLabel("Amount", { exact: true }).fill("50000");
  await page.getByLabel("Date", { exact: true }).fill("2027-04-02");
  await page.getByLabel(/Poultry batch/).selectOption({ label: "Batch 1" });
  await page.getByRole("button", { name: "Save purchase" }).click();
  await expect(page.getByRole("heading", { name: "Purchase: UGX 50,000" })).toBeVisible();
  await expect(page.locator("dt", { hasText: "Poultry batch" }).locator("+ dd")).toHaveText("Batch 1");
  await expect(page.locator("dt", { hasText: "Enterprise" }).locator("+ dd")).toHaveText("Batch 1 flock");

  await page.goto(url(farm));
  const bird = page.getByRole("list", { name: "Batch figures" }).getByRole("listitem");
  await expect(metric(bird, "Cost per bird")).toHaveText("UGX 5,000");
  await expect(bird).toContainText("UGX 4,000 of this enterprise's costs are not linked to a batch, so cost per bird may be too low.");
});

test("an expense with no batch keeps working, and income has no batch field", async ({ page }) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}/accounting/new/income`);
  await expect(page.getByRole("button", { name: "Save other income" })).toBeVisible();
  await expect(page.getByLabel(/Poultry batch/)).toHaveCount(0);
  await page.goto(`/farms/${farm}/accounting/new/expense`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Feed" });
  await page.getByLabel("Amount", { exact: true }).fill("700");
  await page.getByLabel("Date", { exact: true }).fill("2027-04-02");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Expense: UGX 700" })).toBeVisible();
  await expect(page.locator("dt", { hasText: "Poultry batch" }).locator("+ dd")).toHaveText("Not linked");
});

test("D-P08-003 an expense saved offline with a batch sends once and counts for that batch", async ({ page, context }) => {
  test.setTimeout(120_000);
  const one = await batch(context, "Offline batch", 10);
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await page.getByRole("button", { name: "Record expense" }).click();
    await page.getByLabel("What was it for?", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Amount", { exact: true }).fill("20000");
    await page.getByLabel(/Poultry batch/).selectOption({ label: "Offline batch" });
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();
    await server.start();
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("All your entries have been sent.")).toBeVisible({ timeout: 20_000 });
    const response = await context.request.get(`${base}/api/v1/farms/${farm}/profitability/metrics`);
    expect(response.status()).toBe(200);
    const body = z.object({ metrics: z.object({ batches: z.array(z.object({ batchId: z.string(), currencies: z.array(z.object({ costs: z.string(), costPerBird: z.object({ value: z.string() }) })) })) }) }).parse(await response.json());
    expect(body.metrics.batches.find(row => row.batchId === one.batchId)?.currencies[0]).toMatchObject({ costs: "20000", costPerBird: { value: "2000" } });
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("the metrics endpoint denies another farmer, a guessed season and an ended session", async ({ context }) => {
  const farm = fixtures.farms.a, api = (query = "") => context.request.get(`/api/v1/farms/${farm}/profitability/metrics${query}`);
  const own = await api();
  expect(own.status()).toBe(200);
  expect(own.headers()["cache-control"]).toContain("no-store");
  expect((await api(`?seasonId=${id()}`)).status()).toBe(403);
  expect((await api(`?tenantId=${id()}`)).status()).toBe(400);
  for (const who of ["b", "admin"] as const) { await identity(context, who); expect((await api()).status()).toBe(403); }
  await identity(context, "a");
  await query("UPDATE auth.sessions SET not_after=now() - interval '1 hour' WHERE id=$1", [fixtures.sessions.a]);
  expect((await api()).status()).toBe(401);
});
