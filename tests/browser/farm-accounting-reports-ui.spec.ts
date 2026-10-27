import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const seed = { fertilizer: "f4040002-0000-4000-8000-000000000111", feed: "f4040002-0000-4000-8000-000000000112", rent: "f4040002-0000-4000-8000-000000000105", cropSales: "f4040002-0000-4000-8000-000000000204", eggSales: "f4040002-0000-4000-8000-000000000202" };
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const alert = (page: Page) => page.locator("form[aria-busy]").getByRole("alert");
async function enterprise(context: BrowserContext, name: string, type: "CROP" | "POULTRY") {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/enterprises`, { headers: origin, data: { requestId: id(), name, type } });
  expect(response.status()).toBe(201);
  return z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await response.json()).enterprise.enterpriseId;
}
async function season(context: BrowserContext, label: string) {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/seasons`, { headers: origin, data: { requestId: id(), label, startDate: "2027-03-01" } });
  expect(response.status()).toBe(201);
  return z.object({ season: z.object({ seasonId: z.uuid() }) }).parse(await response.json()).season.seasonId;
}
async function money(context: BrowserContext, path: string, data: Record<string, unknown>) {
  const response = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/accounting/${path}`, { headers: origin, data: { requestId: id(), currency: "UGX", ...data } });
  expect(response.status()).toBe(201);
  return z.object({ record: z.object({ recordId: z.uuid() }) }).parse(await response.json()).record.recordId;
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  for (const table of ["AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "CropCycle", "PoultryBatch", "Enterprise", "Season", "Plot"]) await query(`DELETE FROM "${table}" WHERE "tenantId"=ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE "TransactionCategory" SET active = true WHERE id = $1', [seed.rent]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "a");
});

test("AC003: link UGX 150,000 fertilizer to maize 2027A; a link matching no crop cycle keeps the draft", async ({ page, context }) => {
  const farm = fixtures.farms.a, maize = await enterprise(context, "Maize", "CROP"), s2027A = await season(context, "2027A"), other = await season(context, "2027B");
  const plot = id();
  await query('INSERT INTO "Plot" (id,"tenantId","farmId",name,area,"areaUnit","createdBy") VALUES ($1,$2,$3,\'Plot 1\',1,\'ACRE\',$4)', [plot, fixtures.tenants.a, farm, fixtures.users.a]);
  const crop = (await query('SELECT id, name FROM "CropCatalog" WHERE active ORDER BY "createdAt" DESC, id DESC LIMIT 1')).rows[0];
  await query('INSERT INTO "CropCycle" (id,"tenantId","farmId","enterpriseId","seasonId","plotId","cropId","cropName","areaPlanted","areaUnit","plantingDate","createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,\'ACRE\',\'2027-03-01\',$9)', [id(), fixtures.tenants.a, farm, maize, s2027A, plot, crop.id, crop.name, fixtures.users.a]);
  await page.goto(`/farms/${farm}/accounting/new/expense`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Fertilizer" });
  await page.getByLabel("Amount", { exact: true }).fill("150000"); await page.getByLabel("Date", { exact: true }).fill("2027-03-10");
  await page.getByLabel("Enterprise (optional)").selectOption({ label: "Maize — Crops" });
  await page.getByLabel("Season (optional)").selectOption({ label: "2027B" });
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(alert(page)).toContainText("must match one of its crop cycles");
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("150000");
  expect((await query('SELECT count(*)::int AS n FROM "AccountingRecord" WHERE "farmId"=$1', [farm])).rows[0].n).toBe(0);
  await page.getByLabel("Season (optional)").selectOption({ label: "2027A" });
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Expense: UGX 150,000" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Maize", exact: true })).toHaveAttribute("href", `/farms/${farm}/enterprises/${maize}`);
  await expect(page.getByRole("link", { name: "2027A", exact: true })).toHaveAttribute("href", `/farms/${farm}/seasons/${s2027A}`);
  const rows = (await query('SELECT amount::text, "enterpriseId", "seasonId" FROM "AccountingRecord" WHERE "farmId"=$1', [farm])).rows;
  expect(rows).toEqual([{ amount: "150000.0000", enterpriseId: maize, seasonId: s2027A }]);
  expect(other).not.toBe(s2027A);
});

test("AC004 and AC005: gross margin 350,000, summary answers, ties, filters and an audited CSV", async ({ page, context }, info) => {
  const farm = fixtures.farms.a, maize = await enterprise(context, "Maize", "CROP"), layers = await enterprise(context, "Layers", "POULTRY");
  await money(context, "sales", { categoryId: seed.cropSales, amount: "500000", occurredOn: "2027-06-01", enterpriseId: maize });
  await money(context, "expenses", { categoryId: seed.fertilizer, amount: "150000", occurredOn: "2027-03-10", enterpriseId: maize });
  await money(context, "purchases", { categoryId: seed.feed, amount: "80000", occurredOn: "2027-04-01", enterpriseId: layers });
  await money(context, "expenses", { categoryId: seed.rent, amount: "20000", occurredOn: "2027-02-01" });
  await page.goto(`/farms/${farm}`); await page.getByRole("link", { name: "Money summary" }).click();
  const ugx = page.getByRole("region", { name: "Amounts in UGX" });
  await expect(ugx.getByText("UGX 250,000", { exact: true })).toBeVisible(); await expect(ugx.getByText("UGX 500,000", { exact: true })).toBeVisible();
  await expect(ugx.getByText("Maize: UGX 150,000")).toBeVisible();
  await expect(page.getByRole("list", { name: "Spending by category in UGX" }).getByRole("listitem")).toHaveText(["FertilizerUGX 150,000", "FeedUGX 80,000", "RentUGX 20,000"]);
  mkdirSync(".cache/p04-t015-visual", { recursive: true });
  await page.screenshot({ path: `.cache/p04-t015-visual/summary-${info.project.name}.png`, fullPage: true }); await noSideScroll(page);
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download this summary (CSV)" }).click();
  const file = await download; expect(file.suggestedFilename()).toBe("myfarm-money-summary-accrual-start_latest.csv");
  const csv = readFileSync((await file.path())!, "utf8");
  expect(csv).toContain("Money spent,UGX,All spending,250000"); expect(csv).toContain("Gross margin,UGX,Maize,350000");
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE action=\'ACCOUNTING_SUMMARY_EXPORTED\' AND "targetId"=$1', [farm])).rows[0].n).toBeGreaterThanOrEqual(1);
  await money(context, "purchases", { categoryId: seed.feed, amount: "70000", occurredOn: "2027-04-02", enterpriseId: layers });
  await page.reload(); await expect(ugx.getByText(/Layers and Maize \(tied\): UGX 150,000|Maize and Layers \(tied\): UGX 150,000/)).toBeVisible();
  await page.getByRole("link", { name: "Gross margin" }).first().click();
  const maizeCard = page.getByRole("list", { name: "Gross margin by enterprise in UGX" }).getByRole("listitem").filter({ hasText: "Maize" });
  await expect(maizeCard).toContainText("UGX 500,000"); await expect(maizeCard).toContainText("UGX 150,000"); await expect(maizeCard).toContainText("UGX 350,000");
  await expect(page.getByText(/Not linked to an enterprise \(not included above\): money received UGX 0, money spent UGX 20,000/)).toBeVisible();
  await page.screenshot({ path: `.cache/p04-t015-visual/gross-margin-${info.project.name}.png`, fullPage: true }); await noSideScroll(page);
  await page.getByLabel("From", { exact: true }).fill("2027-03-11"); await page.getByLabel("To", { exact: true }).fill("2027-05-31");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page).toHaveURL(/from=2027-03-11&to=2027-05-31/);
  await expect(page.getByText(/from 2027-03-11 to 2027-05-31/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Gross margin by enterprise in UGX" }).getByRole("listitem")).toHaveCount(1);
  await page.getByLabel("Count money").selectOption("CASH"); await page.getByLabel("From", { exact: true }).fill(""); await page.getByLabel("To", { exact: true }).fill("");
  await page.getByRole("button", { name: "Show" }).click();
  await expect(page.getByText(/Counted when money moved \(cash\), all records/)).toBeVisible();
  await page.goto(`/farms/${farm}/accounting/gross-margin?from=2027-06-02&to=2027-06-01`);
  await expect(page.getByRole("form", { name: "Report filters" }).getByRole("alert")).toContainText("Check the dates");
  await page.goto(`/farms/${fixtures.farms.a2}/accounting/summary`); await expect(page.getByRole("heading", { name: "No money records in this period" })).toBeVisible();
});

test("AC002: an archived category stays readable on past records and leaves the picker", async ({ page, context }) => {
  const farm = fixtures.farms.a, recordId = await money(context, "expenses", { categoryId: seed.rent, amount: "20000", occurredOn: "2027-02-01" });
  await query('UPDATE "TransactionCategory" SET active = false WHERE id = $1', [seed.rent]);
  try {
    await page.goto(`/farms/${farm}/accounting/records/${recordId}`);
    await expect(page.getByText("Rent", { exact: true })).toBeVisible();
    await expect(page.getByText("No longer offered for new records. This record keeps the name it was saved with.")).toBeVisible();
    await page.goto(`/farms/${farm}/accounting`); await expect(page.getByText("Rent (no longer offered)")).toBeVisible();
    await page.goto(`/farms/${farm}/accounting/new/expense`);
    await expect(page.getByLabel("Category", { exact: true }).getByRole("option", { name: "Rent" })).toHaveCount(0);
    await expect(page.getByLabel("Category", { exact: true }).getByRole("option")).toHaveCount(13);
  } finally { await query('UPDATE "TransactionCategory" SET active = true WHERE id = $1', [seed.rent]); }
});

test("reports and exports are denied to other users and admins", async ({ page, context }) => {
  const farm = fixtures.farms.a;
  await money(context, "expenses", { categoryId: seed.rent, amount: "20000", occurredOn: "2027-02-01" });
  const before = (await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE action=\'ACCOUNTING_SUMMARY_EXPORTED\' AND "targetId"=$1', [farm])).rows[0].n;
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const path of ["summary", "gross-margin"]) { await page.goto(`/farms/${farm}/accounting/${path}`); await expect(page).toHaveURL(/\/forbidden$/); }
    const denied = await context.request.get(`/api/v1/farms/${farm}/accounting/summary/export`); expect(denied.status()).toBe(403);
    expect(denied.headers()["content-type"]).toContain("application/json"); expect(await denied.text()).not.toContain("Rent");
  }
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE action=\'ACCOUNTING_SUMMARY_EXPORTED\' AND "targetId"=$1', [farm])).rows[0].n).toBe(before);
  await identity(context, "a");
  const exported = await context.request.get(`/api/v1/farms/${farm}/accounting/summary/export?basis=CASH`);
  expect(exported.status()).toBe(200); expect(exported.headers()["content-type"]).toContain("text/csv");
  expect(exported.headers()["cache-control"]).toContain("no-store"); expect(exported.headers()["content-disposition"]).toContain("attachment");
});
