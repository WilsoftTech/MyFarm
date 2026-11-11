import { expect, test, type BrowserContext, type Page } from "../support/browser-test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { clearInventoryBrowser } from "../support/inventory-browser";

const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const feedCategory = "f4040002-0000-4000-8000-000000000112", animal = "f4030008-0000-4000-8000-000000000004";
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
// The app judges on the farm's own date (Africa/Kampala), so the records are laid out around today.
const kampalaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset: number) => { const [y, m, d] = kampalaToday.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10); };
async function create<T extends z.ZodType>(context: BrowserContext, path: string, data: Record<string, unknown>, shape: T, farm = fixtures.farms.a): Promise<z.output<T>> {
  const response = await context.request.post(`/api/v1/farms/${farm}/${path}`, { headers: origin, data: { requestId: id(), ...data } });
  expect(response.status()).toBe(201);
  return shape.parse(await response.json());
}
/**
 * The source example (P0580-P0587) on this farm: 500 layers, eggs 400 a day then 9,757 over the last 4 weeks (-12%),
 * feed 500,000 then 613,800 UGX (+24% per bird), and 5 then 12 deaths (+1.4 points). Daily eggs go straight into the
 * test database, as weeks of entries would; the batch, deaths and costs go through the API.
 */
async function sourceBatch(context: BrowserContext, label: string, thin = false) {
  const enterpriseId = (await create(context, "enterprises", { name: label + " flock", type: "POULTRY" }, z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }))).enterprise.enterpriseId;
  const batchId = (await create(context, "poultry-batches", { enterpriseId, animalTypeId: animal, batchLabel: label, startingQuantity: 500, acquisitionDate: day(-100), purpose: "EGGS" }, z.object({ batch: z.object({ batchId: z.uuid() }) }))).batch.batchId;
  const locationId = (await create(context, "storage-locations", { name: "Store " + id().slice(0, 8) }, z.object({ location: z.object({ storageLocationId: z.uuid() }) }))).location.storageLocationId;
  const eggs = [...Array.from({ length: thin ? 0 : 28 }, (_, i) => [day(-56 + i), 400]), ...Array.from({ length: 28 }, (_, i) => [day(-28 + i), i < 13 ? 349 : 348])];
  for (const [occurredOn, count] of eggs) await query(`INSERT INTO "ProductionEvent" (id, "tenantId", "farmId", "batchId", "locationId", type, quantity, unit, "occurredOn", "requestHash", "createdBy")
    VALUES ($1, $2, $3, $4, $5, 'EGGS', $6, 'EGG', $7, $8, $9)`, [id(), fixtures.tenants.a, fixtures.farms.a, batchId, locationId, count, occurredOn, "f".repeat(64), fixtures.users.a]);
  if (thin) return batchId;
  for (const [quantity, occurredOn] of [["5", day(-29)], ["12", day(-1)]]) await create(context, "poultry-production", { batchId, locationId, type: "MORTALITY", quantity, unit: "BIRD", occurredOn }, z.object({}).loose());
  for (const [amount, occurredOn] of [["250000", day(-52)], ["250000", day(-38)], ["306900", day(-24)], ["306900", day(-10)]])
    await create(context, "accounting/expenses", { currency: "UGX", categoryId: feedCategory, amount, occurredOn, enterpriseId, batchId }, z.object({}).loose());
  return batchId;
}
const card = (page: Page, title: string) => page.getByRole("article", { name: title });

test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  await query('DELETE FROM "FarmInsight" WHERE "tenantId" = ANY($1::uuid[])', [Object.values(fixtures.tenants)]);
  await clearInventoryBrowser(fixtures);
  for (const table of ["BatchFeedItem", "AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "CropCycle", "PoultryBatch", "Enterprise"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "a");
});
// Other specs delete poultry batches in their own setup; an insight left behind would block them.
test.afterEach(async () => { for (const table of ["FarmInsight", "BatchFeedItem"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]); });

test("MYF-P10-AC001 an alert shows its values, both periods, the rule version and the coverage, and can be marked as seen", async ({ page, context }) => {
  await sourceBatch(context, "Layers A");
  await page.goto(`/farms/${fixtures.farms.a}`);
  await page.getByRole("link", { name: "Alerts" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Alerts" })).toBeVisible();
  const warning = card(page, "Fewer eggs while feed costs more");
  await expect(warning.getByText("Warning", { exact: true })).toBeVisible();
  await expect(warning).toContainText("Batch: Layers A");
  await expect(warning).toContainText(/1000 UGX\s*→\s*then\s*1240 UGX/);
  await expect(warning).toContainText(/80\s*→\s*then\s*70\.4/);
  await expect(warning).toContainText("Change: +24%");
  await expect(warning).toContainText("Change: -12%");
  await expect(warning).toContainText(`Last 4 weeks: ${day(-28)} to ${day(-1)}. Compared with ${day(-56)} to ${day(-29)}.`);
  await expect(warning).toContainText("Days with records each week: 7, 7, 7, 7 before, then 7, 7, 7, 7. Birds at the start: 500, then 495.");
  await expect(warning).toContainText("(version 1)");
  const watch = card(page, "More birds are dying than before");
  await expect(watch.getByText("Watch", { exact: true })).toBeVisible();
  await expect(watch).toContainText("Change: +1.4 points");
  await noSideScroll(page);

  await watch.getByRole("button", { name: "I have seen this" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Marked as seen." })).toBeVisible();
  await expect(card(page, "More birds are dying than before")).toContainText("You marked this as seen");
  await page.reload();
  await expect(page.getByRole("article", { name: "More birds are dying than before" })).toHaveCount(1);
  await expect(card(page, "Fewer eggs while feed costs more").getByRole("button", { name: "I have seen this" })).toBeVisible();
});

test("thin records are listed with the reason, and a farm without batches says so", async ({ page, context }) => {
  await sourceBatch(context, "Young layers", true);
  await page.goto(`/farms/${fixtures.farms.a}/insights`);
  await expect(page.getByText("No alerts. Nothing has gone past the rules on what could be checked.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Not enough records to check" })).toBeVisible();
  await expect(page.getByText("Young layers: Eggs per 100 birds a day")).toBeVisible();
  await expect(page.getByText("No eggs were recorded in the earlier 4 weeks.").first()).toBeVisible();
  await page.goto(`/farms/${fixtures.farms.a2}/insights`);
  await expect(page.getByText("No active poultry batch or crop to check.", { exact: false })).toBeVisible();
  await noSideScroll(page);
});

test("another farmer cannot see or acknowledge this farm's alerts; a stale acknowledgement is refused", async ({ page, context }) => {
  await sourceBatch(context, "Layers A");
  const feed = await context.request.get(`/api/v1/farms/${fixtures.farms.a}/insights`);
  expect(feed.status()).toBe(200);
  const insight = z.object({ feed: z.object({ insights: z.array(z.object({ insightId: z.uuid(), version: z.number() })) }) }).parse(await feed.json()).feed.insights[0];
  const ack = (data: Record<string, unknown>) => context.request.post(`/api/v1/farms/${fixtures.farms.a}/insights/${insight.insightId}/acknowledge`, { headers: origin, data });
  expect((await ack({ requestId: id(), expectedVersion: insight.version })).status()).toBe(200);
  expect((await ack({ requestId: id(), expectedVersion: insight.version })).status()).toBe(409);
  expect((await context.request.post(`/api/v1/farms/${fixtures.farms.a}/insights/${insight.insightId}/acknowledge`, { data: { requestId: id(), expectedVersion: 2 } })).status()).toBe(403);
  await identity(context, "b");
  expect((await context.request.get(`/api/v1/farms/${fixtures.farms.a}/insights`)).status()).toBe(403);
  expect((await ack({ requestId: id(), expectedVersion: 2 })).status()).toBe(403);
  await page.goto(`/farms/${fixtures.farms.a}/insights`);
  await expect(page).toHaveURL(/\/forbidden$/);
});

/** A batch fed 50 kg a day for the last 14 days, with 6 of its 500 birds dead in the last week. */
async function feederBatch(context: BrowserContext) {
  const enterpriseId = (await create(context, "enterprises", { name: "Feeder flock", type: "POULTRY" }, z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }))).enterprise.enterpriseId;
  const batchId = (await create(context, "poultry-batches", { enterpriseId, animalTypeId: animal, batchLabel: "Feeder", startingQuantity: 500, acquisitionDate: day(-100), purpose: "EGGS" }, z.object({ batch: z.object({ batchId: z.uuid() }) }))).batch.batchId;
  const locationId = (await create(context, "storage-locations", { name: "Store " + id().slice(0, 8) }, z.object({ location: z.object({ storageLocationId: z.uuid() }) }))).location.storageLocationId;
  for (let i = -14; i < 0; i++) await query(`INSERT INTO "ProductionEvent" (id, "tenantId", "farmId", "batchId", "locationId", type, quantity, unit, "occurredOn", "requestHash", "createdBy")
    VALUES ($1, $2, $3, $4, $5, 'FEED', 50, 'KG', $6, $7, $8)`, [id(), fixtures.tenants.a, fixtures.farms.a, batchId, locationId, day(i), "f".repeat(64), fixtures.users.a]);
  await create(context, "poultry-production", { batchId, locationId, type: "MORTALITY", quantity: "6", unit: "BIRD", occurredOn: day(-3) }, z.object({}).loose());
  return { batchId, locationId };
}
const supply = async (context: BrowserContext, name: string, unit: string) =>
  (await create(context, "inventory-items", { name, unit }, z.object({ result: z.object({ itemId: z.uuid() }) }))).result.itemId;

test("MYF-P10-AC002 thresholds and the feed in stock are stated, and units must match before feed is judged", async ({ page, context }) => {
  const { batchId, locationId } = await feederBatch(context);
  await page.goto(`/farms/${fixtures.farms.a}/insights`);
  const deaths = card(page, "Many birds died this week");
  await expect(deaths.getByText("Warning", { exact: true })).toBeVisible();
  await expect(deaths).toContainText("6 of 500 (1.2%)");
  await expect(deaths).toContainText("Rule: More than 1% of the birds died in the last 7 days (version 1).");
  await expect(deaths).toContainText("Have a vet or extension officer look at the flock.");
  await expect(page.getByText("No feed item is chosen for this batch. Choose the supply it is fed from.")).toBeVisible();

  // A feed counted in bags cannot be compared with feed given in kg: it is reported, not guessed.
  await supply(context, "Maize bran", "BAG");
  await page.goto(`/farms/${fixtures.farms.a}/poultry-batches/${batchId}`);
  await expect(page.getByText("No feed item chosen.", { exact: false })).toBeVisible();
  await page.getByLabel("Feed item in stock").selectOption({ label: "Maize bran (BAG)" });
  await expect(page.getByText("This item is not counted in kg", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Save feed item" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Feed item saved." })).toBeVisible();
  await page.goto(`/farms/${fixtures.farms.a}/insights`);
  await expect(page.getByText("The chosen feed item is not counted in kg, so it cannot be compared with feed given in kg.")).toBeVisible();

  // 300 kg against 50 kg a day lasts 6 days: under the 7-day threshold.
  const mash = await supply(context, "Layer mash", "KG");
  await create(context, "stock-operations", { itemId: mash, locationId, type: "ADJUSTMENT", direction: "IN", quantity: "300", unit: "KG", occurredOn: day(-15), reason: "Opening count" }, z.object({}).loose());
  await page.goto(`/farms/${fixtures.farms.a}/poultry-batches/${batchId}`);
  await expect(page.getByText("Fed from: Maize bran (BAG).")).toBeVisible();
  await page.getByLabel("Feed item in stock").selectOption({ label: "Layer mash (KG)" });
  await page.getByRole("button", { name: "Save feed item" }).click();
  await expect(page.getByText("Fed from: Layer mash (KG).")).toBeVisible();
  await page.goto(`/farms/${fixtures.farms.a}/insights`);
  const low = card(page, "Feed is running low");
  await expect(low).toContainText("Layer mash");
  await expect(low).toContainText("300 kg");
  await expect(low).toContainText("50 kg");
  await expect(low).toContainText("6 days");
  await expect(low).toContainText("7, 7");
  await expect(low).toContainText(`Period: ${day(-14)} to ${day(-1)}.`);
  await expect(low).toContainText("Rule: Feed in stock lasts fewer than 7 days at the last 14 days' use (version 1).");
  await noSideScroll(page);
});

test("offline, the alert stays readable and marking it as seen waits for a connection", async ({ page, context }) => {
  await sourceBatch(context, "Layers A");
  await page.goto(`/farms/${fixtures.farms.a}/insights`);
  const watch = card(page, "More birds are dying than before");
  await expect(watch.getByRole("button", { name: "I have seen this" })).toBeEnabled();
  await context.setOffline(true);
  try {
    await expect(watch.getByText("You are offline. Your details are still here. Reconnect to save.")).toBeVisible();
    await expect(watch.getByRole("button", { name: "I have seen this" })).toBeDisabled();
  } finally { await context.setOffline(false); }
  await expect(watch.getByRole("button", { name: "I have seen this" })).toBeEnabled();
});
