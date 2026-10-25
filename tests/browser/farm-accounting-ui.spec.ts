import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { Client } from "pg";
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
const alert = (page: Page) => page.locator("form[aria-busy]").getByRole("alert");
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const counts = async (farmId: string) => (await query('SELECT (SELECT count(*)::int FROM "AccountingRecord" WHERE "farmId"=$1) AS records, (SELECT count(*)::int FROM "PaymentRecord" WHERE "farmId"=$1) AS payments', [farmId])).rows[0];
async function fillSale(page: Page, amount = "200000") {
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Crop sales" });
  await page.getByLabel("Amount", { exact: true }).fill(amount);
  await page.getByLabel("Date", { exact: true }).fill("2027-06-01");
  await page.getByLabel("Buyer (optional)").fill("Market buyer");
}
async function saveSale(page: Page) {
  await page.getByRole("button", { name: "Save sale" }).click();
  await expect(page.getByRole("status")).toHaveText("Record saved.");
  await expect(page.getByRole("heading", { name: "Sale: UGX 200,000" })).toBeVisible();
}
async function receive(page: Page, amount: string) {
  await page.getByRole("link", { name: "Record money received" }).click();
  await page.getByLabel("Amount received (UGX)").fill(amount);
  await page.getByLabel("Date received").fill("2027-06-05");
  await page.getByLabel("How it was received").selectOption({ label: "Mobile Money" });
  await page.getByRole("button", { name: "Record money received" }).click();
  await expect(page.getByRole("status")).toHaveText("Payment saved.");
}
const due = (page: Page) => page.getByRole("region", { name: "Money for this sale" });
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  for (const table of ["AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord"]) await query(`DELETE FROM "${table}" WHERE "tenantId"=ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "a");
});

test("AC001: one sale, a partial payment, UGX 120,000 still to receive and one revenue record", async ({ page }, info) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}`); await page.getByRole("link", { name: "Money records", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No money records yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add sale" }).first().click();
  await expect(page.getByRole("heading", { name: "Record a sale" })).toBeVisible();
  await expect(page.getByLabel(/How it was/)).toHaveCount(0);
  await page.getByRole("button", { name: "Save sale" }).click();
  await expect(page.getByLabel("Category", { exact: true })).toBeFocused();
  await fillSale(page, "200,000"); await page.getByRole("button", { name: "Save sale" }).click();
  await expect(page.getByText("Enter an amount above 0 using digits, with up to 4 decimal places.")).toBeVisible();
  await expect(page.getByLabel("Amount", { exact: true })).toBeFocused();
  await page.getByLabel("Amount", { exact: true }).fill("200000");
  mkdirSync(".cache/p04-t003-visual", { recursive: true });
  await page.screenshot({ path: `.cache/p04-t003-visual/sale-form-${info.project.name}.png`, fullPage: true }); await noSideScroll(page);
  await saveSale(page);
  await expect(due(page).getByText("Nothing received yet", { exact: false })).toBeVisible();
  await receive(page, "80000");
  await expect(due(page).getByText("Partly received", { exact: false })).toBeVisible();
  await expect(due(page).getByText("UGX 80,000", { exact: true }).first()).toBeVisible();
  await expect(due(page).getByText("UGX 120,000", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Payments for this record" }).getByRole("listitem")).toHaveCount(1);
  await page.screenshot({ path: `.cache/p04-t003-visual/sale-detail-${info.project.name}.png`, fullPage: true }); await noSideScroll(page);
  expect(await counts(farm)).toEqual({ records: 1, payments: 1 });
  const revenue = await query('SELECT kind, amount::text FROM "AccountingRecord" WHERE "farmId"=$1', [farm]);
  expect(revenue.rows).toEqual([{ kind: "SALE", amount: "200000.0000" }]);
  await page.getByRole("link", { name: "Money records" }).first().click();
  const list = page.getByRole("list", { name: "Money records on this farm" });
  await expect(list.getByRole("listitem")).toHaveCount(1); await expect(list.getByText("Still to receive: UGX 120,000")).toBeVisible();
  await page.screenshot({ path: `.cache/p04-t003-visual/money-list-${info.project.name}.png`, fullPage: true }); await noSideScroll(page);
});

test("an expense records how it was paid; a purchase is paid in full; farms stay separate", async ({ page }) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}/accounting/new/expense`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Fertilizer" });
  await page.getByLabel("Amount", { exact: true }).fill("0150000.00");
  await page.getByLabel("Date", { exact: true }).fill("2027-03-10");
  await page.getByLabel("Paid to (optional)").fill("ABC Agro");
  await page.getByLabel("How it was paid (optional)").selectOption({ label: "Mobile Money" });
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("heading", { name: "Expense: UGX 150,000" })).toBeVisible();
  await expect(page.getByText("Mobile Money", { exact: true })).toBeVisible(); await expect(page.getByText("ABC Agro", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Record (money received|a payment)/ })).toHaveCount(0);
  await page.goto(`/farms/${farm}/accounting/new/purchase`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Seeds" });
  await page.getByLabel("Amount", { exact: true }).fill("50000"); await page.getByLabel("Date", { exact: true }).fill("2027-03-01");
  await page.getByRole("button", { name: "Save purchase" }).click(); await expect(page.getByRole("status")).toHaveText("Record saved.");
  await page.getByRole("link", { name: "Record a payment" }).click();
  await expect(page.getByLabel("Amount paid (UGX)")).toHaveValue("50000");
  await page.getByLabel("Date paid").fill("2027-03-02"); await page.getByLabel("How it was paid").selectOption({ label: "Cash" });
  await page.getByRole("button", { name: "Record a payment" }).click(); await expect(page.getByRole("status")).toHaveText("Payment saved.");
  await expect(page.getByText("Fully paid", { exact: false })).toBeVisible(); await expect(page.getByRole("link", { name: "Record a payment" })).toHaveCount(0);
  await page.goto(`/farms/${fixtures.farms.a2}/accounting`); await expect(page.getByRole("heading", { name: "No money records yet" })).toBeVisible();
  expect(await counts(farm)).toEqual({ records: 2, payments: 1 });
});

test("overpayment and a lost response keep the draft and never duplicate a payment", async ({ page, context }) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}/accounting/new/sale`); await fillSale(page); await saveSale(page);
  const recordId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByRole("link", { name: "Record money received" }).click();
  await page.getByLabel("Amount received (UGX)").fill("150000"); await page.getByLabel("Date received").fill("2027-06-05");
  await page.getByLabel("How it was received").selectOption({ label: "Cash" });
  const other = await context.request.post(`/api/v1/farms/${farm}/accounting/payments`, { headers: { origin: "http://127.0.0.1:3102" }, data: { requestId: id(), direction: "RECEIVED", amount: "100000", currency: "UGX", paidOn: "2027-06-04", paymentMethodId: "f4040002-0000-4000-8000-000000000303", allocations: [{ obligationId: recordId, amount: "100000" }] } });
  expect(other.status()).toBe(201);
  await page.getByRole("button", { name: "Record money received" }).click();
  await expect(alert(page)).toContainText("more than what is still due");
  await expect(page.getByLabel("Amount received (UGX)")).toHaveValue("150000");
  await page.getByLabel("Amount received (UGX)").fill("100000");
  let interrupted = false;
  await page.route("**/payments/new", async route => {
    if (route.request().method() === "POST" && !interrupted) { interrupted = true; await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Record money received" }).click();
  await expect(alert(page)).toContainText("Connection interrupted");
  await page.getByRole("button", { name: "Record money received" }).click();
  await expect(page.getByRole("status")).toHaveText("Payment saved.");
  await expect(page.getByText("Fully received", { exact: false })).toBeVisible();
  expect(await counts(farm)).toEqual({ records: 1, payments: 2 });
});

test("payments are reversed before the sale; reversals keep history and restore what is due", async ({ page }) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}/accounting/new/sale`); await fillSale(page); await saveSale(page); await receive(page, "80000");
  await expect(page.getByText("first reverse each payment listed above", { exact: false })).toBeVisible();
  await expect(page.getByRole("form", { name: "Reverse this sale" })).toHaveCount(0);
  await page.getByRole("list", { name: "Payments for this record" }).getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Money received: UGX 80,000" })).toBeVisible();
  await page.getByRole("button", { name: "Reverse this payment" }).click();
  await expect(page.getByText("Explain why this record is being reversed.")).toBeVisible();
  await page.getByLabel("Reason", { exact: true }).fill("Wrong amount"); await page.getByLabel("I understand that reversing is final.").check();
  await page.getByRole("button", { name: "Reverse this payment" }).click();
  await expect(page.getByRole("status")).toHaveText("Payment reversed. The amount is due again on the record it settled.");
  await expect(page.getByText("Reason: Wrong amount")).toBeVisible();
  await page.getByRole("link", { name: "UGX 80,000 towards a sale" }).click();
  await expect(due(page).getByText("Nothing received yet", { exact: false })).toBeVisible();
  await expect(page.getByRole("list", { name: "Payments for this record" }).getByText("Reversed")).toBeVisible();
  await page.getByLabel("Reason", { exact: true }).fill("Buyer cancelled"); await page.getByLabel("I understand that reversing is final.").check();
  await page.getByRole("button", { name: "Reverse this sale" }).click();
  await expect(page.getByRole("status")).toHaveText("Record reversed. It stays in your history and no longer counts.");
  await expect(page.getByText("Reason: Buyer cancelled")).toBeVisible(); await expect(page.getByRole("link", { name: "Record money received" })).toHaveCount(0);
  const rows = await query('SELECT status, amount::text FROM "AccountingRecord" WHERE "farmId"=$1', [farm]);
  expect(rows.rows).toEqual([{ status: "REVERSED", amount: "200000.0000" }]);
});

test("offline forms keep details and save once after reconnecting", async ({ page, context }) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}/accounting/new/sale`); await fillSale(page);
  await context.setOffline(true);
  try { await expect(page.getByRole("button", { name: "Save sale" })).toBeDisabled(); await expect(page.getByText(/You are offline/)).toBeVisible(); await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("200000"); }
  finally { await context.setOffline(false); }
  await saveSale(page); expect(await counts(farm)).toEqual({ records: 1, payments: 0 });
});

test("other farms, users and kinds are denied; revocation keeps the draft; expired sessions sign in again", async ({ page, context }) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}/accounting/new/sale`); await fillSale(page); await saveSale(page);
  const detail = new URL(page.url()).pathname, recordId = detail.split("/").at(-1);
  await page.goto(`/farms/${fixtures.farms.a2}/accounting/records/${recordId}`); await expect(page).toHaveURL(/\/forbidden$/);
  await page.goto(`/farms/${fixtures.farms.a2}/accounting/records/${recordId}/payments/new`); await expect(page).toHaveURL(/\/forbidden$/);
  // Streamed pages keep HTTP 200 for notFound() (inherited Phase 3 limitation); assert the rendered page instead.
  await page.goto(`/farms/${farm}/accounting/new/loan`);
  await expect(page.getByText("This page could not be found.")).toBeVisible(); await expect(page.locator("form")).toHaveCount(0);
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const path of [`/farms/${farm}/accounting`, `/farms/${farm}/accounting/new/expense`, detail]) { await page.goto(path); await expect(page).toHaveURL(/\/forbidden$/); }
  }
  await identity(context, "a"); await page.goto(`/farms/${farm}/accounting/new/sale`); await fillSale(page, "5000");
  await query('UPDATE "FarmMember" SET status=\'REVOKED\' WHERE "farmId"=$1 AND "userId"=$2', [farm, fixtures.users.a]);
  try { await page.getByRole("button", { name: "Save sale" }).click(); await expect(alert(page)).toContainText("You do not have access"); await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("5000"); }
  finally { await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "farmId"=$1 AND "userId"=$2', [farm, fixtures.users.a]); }
  expect(await counts(farm)).toEqual({ records: 1, payments: 0 });
  await query('UPDATE auth.sessions SET not_after=now()-interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  await page.goto(`/farms/${farm}/accounting`); await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
});
