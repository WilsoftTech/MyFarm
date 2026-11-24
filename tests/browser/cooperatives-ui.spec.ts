import { test, expect, type BrowserContext, type Page } from "../support/browser-test";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
let fixtures: ProductionBrowserFixtures, org: string;
async function query(sql: string, params: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, params); } finally { await db.end(); }
}
async function signIn(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
const form = (page: Page, title: string) => page.getByRole("heading", { name: title, exact: true }).locator("..");
async function confirm(page: Page, title: string) {
  const region = form(page, title);
  await region.getByRole("button", { name: "Review details", exact: true }).click();
  await expect(region.getByRole("heading", { name: "Confirm this exact review" })).toBeVisible();
  const response = page.waitForResponse(r => r.url().includes("/api/v1/cooperatives/") && r.request().method() === "POST");
  await region.getByRole("button", { name: "Confirm and save" }).click();
  expect((await response).status()).toBe(200);
}
test.beforeEach(async () => {
  fixtures = readProductionBrowserFixtures(); org = crypto.randomUUID();
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Browser cooperative\',\'ORGANIZATION\')', [org]);
  for (const [who, role, status] of [["admin", "MANAGER", "ACTIVE"], ["a", "FARMER", "INVITED"], ["b", "BUYER", "ACTIVE"]] as const) await query('INSERT INTO "CooperativeMember" (id,"organizationId","userId","invitedBy",role,status) VALUES ($1,$2,$3,$4,$5,$6)', [crypto.randomUUID(), org, fixtures.users[who], fixtures.users.admin, role, status]);
});
test.afterEach(async () => {
  for (const table of ["CooperativeReceipt", "CooperativeEntry", "CooperativeForecast", "CooperativeLot", "CooperativeShare", "CooperativeMember"]) await query('DELETE FROM "' + table + '" WHERE "organizationId"=$1', [org]);
  await query('DELETE FROM "AuditEvent" WHERE "tenantId"=$1', [org]); await query('DELETE FROM "Organization" WHERE id=$1', [org]);
});
test("member accepts, farmer shares/forecasts, manager procures/pays and buyer sees only publication; withdrawal preserves history", async ({ page, context }, info) => {
  test.setTimeout(120_000);
  await signIn(context, "a"); await page.goto("/cooperatives");
  await confirm(page, "Accept membership");
  await page.goto(`/cooperatives/${org}?section=farms`);
  const sharing = form(page, "Share one of my farms");
  await sharing.getByLabel("My farm", { exact: true }).selectOption(fixtures.farms.a);
  await sharing.getByLabel("Share production estimates and permit procurement records").check();
  await confirm(page, "Share one of my farms");
  await expect(page.getByRole("heading", { name: "Browser farm A", exact: true })).toBeVisible();
  const forecast = form(page, "Declare expected production");
  await forecast.getByLabel("Product", { exact: true }).fill("Maize"); await forecast.getByLabel("Unit", { exact: true }).selectOption("KG"); await forecast.getByLabel("Expected quantity", { exact: true }).fill("12.5");
  await forecast.getByLabel("Harvest window starts").fill("2026-12-01"); await forecast.getByLabel("Harvest window ends").fill("2026-12-31");
  await confirm(page, "Declare expected production");
  await expect(page.getByText("Maize: 12.5 KG, 2026-12-01 to 2026-12-31")).toBeVisible();
  await signIn(context, "admin"); await page.goto(`/cooperatives/${org}?section=farms`);
  const procurement = form(page, "Record accepted produce");
  for (const [label, value] of [["Product", "Maize"], ["Accepted quantity", "10"], ["Agreed price per unit", "2000"], ["Receiving store", "Main store"], ["Date accepted", "2026-11-24"]]) await procurement.getByLabel(label, { exact: true }).fill(value);
  await procurement.getByLabel("Unit", { exact: true }).selectOption("KG");
  await procurement.getByRole("button", { name: "Review details" }).click();
  await expect(procurement.getByText("Total: UGX 20000")).toBeVisible();
  // Commit succeeds but its response is lost. The visible review is retained for exact retry.
  await page.route("**/operations", async route => { await route.fetch(); await route.abort("failed"); }, { times: 1 });
  await procurement.getByRole("button", { name: "Confirm and save" }).click();
  await expect(procurement.getByText(/Connection interrupted/)).toBeVisible();
  await page.reload();
  const recovered = form(page, "Record accepted produce");
  await expect(recovered.getByText(/Recovered this tab/)).toBeVisible();
  await expect(recovered.getByRole("button", { name: "Change details" })).toBeDisabled();
  await recovered.getByRole("button", { name: "Confirm and save" }).click();
  await expect(recovered.getByText("Saved and confirmed by MyFarm.")).toBeVisible();
  expect((await query('SELECT count(*)::int AS n FROM "CooperativeLot" WHERE "organizationId"=$1', [org])).rows[0].n).toBe(1);
  await page.goto(`/cooperatives/${org}?section=lots`);
  const payment = form(page, "Record a payment already made");
  await payment.getByLabel("Amount paid").fill("5000"); await payment.getByLabel("Payment reference").fill("Cash receipt 1"); await payment.getByLabel("Date paid").fill("2026-11-24");
  await confirm(page, "Record a payment already made");
  await expect(page.getByText(/recorded paid 5000, still owed 15000/)).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate(el => el.clientWidth));
  await page.screenshot({ path: `.cache/p15-manager-${info.project.name}.png`, fullPage: true });
  await confirm(page, "Publish buyer summary");
  await signIn(context, "b"); await page.goto(`/cooperatives/${org}?section=lots`);
  await expect(page.getByText("Maize: 10 KG in stock")).toBeVisible();
  await expect(page.getByText("Total agreed:", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Origin sharing reference:", { exact: false })).toHaveCount(0);
  const denied = await context.request.get(`/api/v1/cooperatives/${org}?section=members`); expect(denied.status()).toBe(403);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate(el => el.clientWidth));
  await page.screenshot({ path: `.cache/p15-buyer-${info.project.name}.png`, fullPage: true });
  await signIn(context, "a"); await page.goto(`/cooperatives/${org}?section=farms`); await confirm(page, "Withdraw farm sharing");
  await signIn(context, "admin"); await page.goto(`/cooperatives/${org}?section=farms`);
  await expect(page.getByRole("heading", { name: "Browser farm A", exact: true })).toHaveCount(0);
  await expect(page.getByText(/recorded paid 5000, still owed 15000/)).toBeVisible();
});
test("anonymous/foreign access, same-origin writes and offline feedback are enforced", async ({ page, context }) => {
  await context.clearCookies(); await page.goto(`/cooperatives/${org}?section=farms`); await expect(page).toHaveURL(/sign-in/);
  await signIn(context, "a");
  const unaccepted = await context.request.get(`/api/v1/cooperatives/${org}?section=farms`); expect(unaccepted.status()).toBe(403);
  const forged = await context.request.post(`/api/v1/cooperatives/${org}/relationships`, { headers: { Origin: "https://foreign.example" }, data: { type: "SHARE" } }); expect(forged.status()).toBe(403);
  await page.goto("/cooperatives");
  await context.setOffline(true);
  await expect(form(page, "Accept membership").getByText(/Unreviewed details are not saved on this device/)).toBeVisible();
  await expect(form(page, "Accept membership").getByRole("button", { name: "Review details" })).toBeDisabled();
  await context.setOffline(false);
});
test("an accepted member without a farmer profile gets a setup path and no private farm access", async ({ page, context }) => {
  // Seed an accepted institutional farmer role for the existing account with no personal Farmer.
  await query('UPDATE "CooperativeMember" SET status=\'REVOKED\',version=version+1 WHERE "organizationId"=$1 AND "userId"=$2', [org, fixtures.users.admin]);
  await query('UPDATE "CooperativeMember" SET status=\'INVITED\',role=\'FARMER\',version=version+1 WHERE "organizationId"=$1 AND "userId"=$2', [org, fixtures.users.admin]);
  await query('UPDATE "CooperativeMember" SET status=\'ACTIVE\',version=version+1 WHERE "organizationId"=$1 AND "userId"=$2', [org, fixtures.users.admin]);
  await signIn(context, "admin"); await page.goto(`/cooperatives/${org}?section=farms`);
  await expect(page.getByRole("link", { name: "Set up your farmer profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser farm A", exact: true })).toHaveCount(0);
  expect((await context.request.get(`/api/v1/farms/${fixtures.farms.a}/accounting/summary`)).status()).toBe(403);
});
