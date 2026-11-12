import { expect, test, type BrowserContext, type Page } from "../support/browser-test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { clearInventoryBrowser } from "../support/inventory-browser";

const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const feed = "f4040002-0000-4000-8000-000000000112", eggSales = "f4040002-0000-4000-8000-000000000202";
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
async function post(context: BrowserContext, path: string, data: Record<string, unknown>) {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/${path}`, { headers: origin, data: { requestId: id(), ...data } });
  expect(response.status()).toBe(201);
  return response.json() as Promise<unknown>;
}
async function ask(page: Page, question: string) {
  await page.getByRole("textbox", { name: "Your question" }).fill(question);
  await page.getByRole("combobox", { name: "Which records" }).selectOption("all");
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
test.afterEach(async () => { for (const table of ["AssistantQuestion", "AssistantUsage"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]); });

test("MYF-P11-AC003 each statement carries its label, the figures match the farm screen, and the labels are explained", async ({ page, context }) => {
  // A farm that spent more than it earned: a fact, a fact, an inference and an uncertainty.
  const enterpriseId = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await post(context, "enterprises", { name: "Goat pen", type: "POULTRY" })).enterprise.enterpriseId;
  await post(context, "accounting/sales", { categoryId: eggSales, amount: "100000", currency: "UGX", occurredOn: "2026-06-01", enterpriseId });
  await post(context, "accounting/expenses", { categoryId: feed, amount: "300000", currency: "UGX", occurredOn: "2026-06-02", enterpriseId });
  await page.goto(`/farms/${fixtures.farms.a}/assistant`);
  const answer = await ask(page, "How much profit did I make?");
  const lines = answer.getByRole("listitem");
  await expect(lines).toHaveText([
    "Fact from your recordsFor all records, money earned was UGX 100,000 and money spent was UGX 300,000, so the recorded surplus is UGX -200,000.",
    "Fact from your recordsThe surplus is -200% of the money earned.",
    "What this suggestsMore money went out than came in for all records, going by these records: UGX -200,000.",
    /^Not certainThis is the recorded surplus: money earned less money spent in your records\. It is not your full profit/,
  ]);
  // Factual values match evidence: the same surplus as the farm screen's own figures.
  const dashboard = z.object({ dashboard: z.object({ currencies: z.array(z.object({ currency: z.string(), recordedSurplus: z.string() })) }) }).parse(await (await context.request.get(`/api/v1/farms/${fixtures.farms.a}/profitability`)).json()).dashboard;
  expect(dashboard.currencies.map(row => [row.currency, row.recordedSurplus])).toEqual([["UGX", "-200000"]]);
  await expect(lines.first()).toContainText("UGX " + Number(dashboard.currencies[0].recordedSurplus).toLocaleString("en-US"));
  await page.getByText("What the labels mean").click();
  for (const [term, meaning] of [["Fact from your records", "Exactly what your records say"], ["What this suggests", "It is not certain"], ["Suggestion", "It is never certain"], ["Not certain", "advice only an extension officer should give"]]) {
    await expect(page.locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]")).toContainText(meaning);
  }
  await noSideScroll(page);
});

test("agronomic questions are labeled not certain and point to an extension officer, never advice", async ({ page }) => {
  await page.goto(`/farms/${fixtures.farms.a}/assistant`);
  for (const question of ["How do I treat sick chickens?", "Which fertilizer is best for beans?"]) {
    const answer = await ask(page, question);
    await expect(answer.getByRole("listitem")).toHaveText(["Not certainMyFarm answers from your own records only. For advice on crops or animals, ask an extension officer."]);
    await expect(answer).not.toContainText("Worked out by MyFarm");
  }
});
