import { expect, test, type BrowserContext, type Page } from "../support/browser-test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { clearInventoryBrowser } from "../support/inventory-browser";

const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const feed = "f4040002-0000-4000-8000-000000000112", eggSales = "f4040002-0000-4000-8000-000000000202", animal = "f4030008-0000-4000-8000-000000000004";
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const kampalaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (offset: number) => { const [y, m, d] = kampalaToday.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10); };
async function post<T extends z.ZodType>(context: BrowserContext, path: string, data: Record<string, unknown>, shape: T): Promise<z.output<T>> {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/${path}`, { headers: origin, data: { requestId: id(), ...data } });
  expect(response.status()).toBe(201);
  return shape.parse(await response.json());
}
const any = z.object({}).loose();
const enterpriseOf = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) });

/** Two seasons, two enterprises, planned and missed work, and the Phase 10 source-example batch (one cost alert). */
async function farmWithRecords(context: BrowserContext) {
  const seasonOf = z.object({ season: z.object({ seasonId: z.uuid() }) });
  const earlier = (await post(context, "seasons", { label: "2025B", startDate: "2025-08-01" }, seasonOf)).season.seasonId;
  const current = (await post(context, "seasons", { label: "2026A", startDate: "2026-03-01" }, seasonOf)).season.seasonId;
  const layers = (await post(context, "enterprises", { name: "Layers house", type: "POULTRY" }, enterpriseOf)).enterprise.enterpriseId;
  const broilers = (await post(context, "enterprises", { name: "Broiler shed", type: "POULTRY" }, enterpriseOf)).enterprise.enterpriseId;
  const money = (kind: "sales" | "expenses", categoryId: string, amount: string, enterpriseId: string, seasonId: string, occurredOn: string) =>
    post(context, "accounting/" + kind, { categoryId, amount, currency: "UGX", occurredOn, enterpriseId, seasonId }, any);
  await money("sales", eggSales, "500000", layers, earlier, "2025-09-01"); await money("expenses", feed, "100000", layers, earlier, "2025-09-02");
  await money("sales", eggSales, "2100000", layers, current, "2026-06-01"); await money("expenses", feed, "680000", layers, current, "2026-06-02");
  await money("sales", eggSales, "900000", broilers, current, "2026-06-03"); await money("expenses", feed, "600000", broilers, current, "2026-06-04");
  await post(context, "activities", { type: "VACCINATION", dueOn: day(2), enterpriseId: layers }, any);
  await post(context, "activities", { type: "VACCINATION", dueOn: day(-3), enterpriseId: broilers }, any);
  // The Phase 10 source example: eggs about 12% down and feed cost per bird about 24% up over the last 4 weeks.
  const flock = (await post(context, "enterprises", { name: "Layers A flock", type: "POULTRY" }, enterpriseOf)).enterprise.enterpriseId;
  const batchId = (await post(context, "poultry-batches", { enterpriseId: flock, animalTypeId: animal, batchLabel: "Layers A", startingQuantity: 500, acquisitionDate: day(-100), purpose: "EGGS" }, z.object({ batch: z.object({ batchId: z.uuid() }) }))).batch.batchId;
  const locationId = (await post(context, "storage-locations", { name: "Store " + id().slice(0, 8) }, z.object({ location: z.object({ storageLocationId: z.uuid() }) }))).location.storageLocationId;
  const eggs = [...Array.from({ length: 28 }, (_, i) => [day(-56 + i), 400]), ...Array.from({ length: 28 }, (_, i) => [day(-28 + i), i < 13 ? 349 : 348])];
  for (const [occurredOn, count] of eggs) await query(`INSERT INTO "ProductionEvent" (id, "tenantId", "farmId", "batchId", "locationId", type, quantity, unit, "occurredOn", "requestHash", "createdBy")
    VALUES ($1, $2, $3, $4, $5, 'EGGS', $6, 'EGG', $7, $8, $9)`, [id(), fixtures.tenants.a, fixtures.farms.a, batchId, locationId, count, occurredOn, "f".repeat(64), fixtures.users.a]);
  for (const [quantity, occurredOn] of [["5", day(-29)], ["12", day(-1)]]) await post(context, "poultry-production", { batchId, locationId, type: "MORTALITY", quantity, unit: "BIRD", occurredOn }, any);
  for (const [amount, occurredOn] of [["250000", day(-52)], ["250000", day(-38)], ["306900", day(-24)], ["306900", day(-10)]])
    await post(context, "accounting/expenses", { currency: "UGX", categoryId: feed, amount, occurredOn, enterpriseId: flock, batchId }, any);
}
async function ask(page: Page, question: string, records: string) {
  await page.getByRole("textbox", { name: "Your question" }).fill(question);
  await page.getByRole("combobox", { name: "Which records" }).selectOption({ label: records });
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page).toHaveURL(/\/assistant\?asked=/);
  return page.getByRole("article", { name: question });
}

test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  await clearInventoryBrowser(fixtures);
  for (const table of ["AssistantQuestion", "AssistantUsage", "FarmInsight", "BatchFeedItem", "AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "ProductionActivity", "ActivityRecurrence", "CropCycle", "PoultryBatch", "Enterprise", "Season"])
    await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
});
// Other specs delete batches, enterprises and seasons in their own setup; leave nothing that would block them.
test.afterEach(async () => {
  for (const table of ["AssistantQuestion", "AssistantUsage", "FarmInsight", "BatchFeedItem", "ProductionActivity"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
});

test("MYF-P11-AC002 every question type answers from this farm's records, says where from, and links to the full page", async ({ page, context }) => {
  test.setTimeout(120_000);
  await farmWithRecords(context);
  await page.goto(`/farms/${fixtures.farms.a}/assistant`);
  // The example buttons fill the box, so a farmer need not type.
  await page.getByRole("button", { name: "Which enterprise made me the most money?" }).click();
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue("Which enterprise made me the most money?");
  const cases: [string, string, RegExp, RegExp, string | null][] = [
    ["How much profit did I make?", "Season 2026A", /^Fact from your recordsFor season 2026A, money earned was UGX 3,000,000 and money spent was UGX 1,280,000, so the recorded surplus is UGX 1,720,000\.$/, /the money figures on the farm screen: season 2026A/, "Open the farm screen"],
    ["Compare this season with the last season", "Season 2026A", /^Fact from your recordsThe recorded surplus was UGX 1,720,000 in 2026A and UGX 400,000 in 2025B: a change of UGX 1,320,000\.$/, /for this season and the one before: season 2026A/, "Open the farm screen"],
    ["Give me a summary of the farm", "Season 2026A", /^Fact from your recordsFor season 2026A, money earned was UGX 3,000,000/, /the money figures on the farm screen/, "Open the farm screen"],
    ["Make me a farm report", "Season 2026A", /^Fact from your recordsFor season 2026A, money earned was UGX 3,000,000/, /the money figures on the farm screen/, "Open the money summary, where you can download it"],
    ["Are any costs unusual?", "All records", /^Fact from your recordsCost alerts open on this farm: 1\.$/, /the farm's alerts, each over its own period\. Calculated/, "Open Alerts"],
    ["What tasks are coming up?", "All records", new RegExp("^Fact from your recordsFarm work due from " + day(0) + " and not yet done: 1\\.$"), /your planned farm work\. Calculated/, "Open Activities"],
    ["Show me my latest records", "All records", /^Fact from your recordsYour latest money records, newest first:$/, /your money records: all records\. Calculated/, "Open all money records"],
  ];
  for (const [question, records, first, source, link] of cases) {
    const answer = await ask(page, question, records);
    await expect(answer.getByRole("listitem").first(), question).toHaveText(first);
    await expect(answer, question).toContainText(source);
    if (link) await expect(answer.getByRole("link", { name: link }), question).toHaveAttribute("href", new RegExp(`^/farms/${fixtures.farms.a}/`));
  }
  const costs = page.getByRole("article", { name: "Are any costs unusual?" });
  await expect(costs.getByRole("listitem").nth(1)).toHaveText(/^Fact from your recordsFewer eggs while feed costs more, Layers A: feed cost per bird went from UGX [\d,.]+ to UGX [\d,.]+, a change of [\d.]+%\.$/);
  const tasks = page.getByRole("article", { name: "What tasks are coming up?" });
  await expect(tasks.getByRole("listitem").nth(1)).toHaveText(new RegExp("for Layers house, due " + day(2) + "\\.$"));
  await expect(tasks).toContainText("Work past its date and not marked done: 1.");
  await expect(page.getByRole("article", { name: "Make me a farm report" })).toContainText("The assistant does not make files.");
  await expect(page.getByRole("article")).toHaveCount(7);
  await noSideScroll(page);
});

test("comparing needs one season; the question box still works offline-safe and a new question keeps the season chosen", async ({ page, context }) => {
  await farmWithRecords(context);
  await page.goto(`/farms/${fixtures.farms.a}/assistant`);
  const answer = await ask(page, "Compare this season with the last season", "All records");
  await expect(answer.getByRole("listitem")).toHaveText("Not certainChoose one season under \"Which records\" to compare it with the season before it.");
  await context.setOffline(true);
  await page.getByRole("textbox", { name: "Your question" }).fill("How much profit did I make?");
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeDisabled();
  await expect(page.getByText("You are offline. Your details are still here. Reconnect to save.")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Your question" })).toHaveValue("How much profit did I make?");
});
