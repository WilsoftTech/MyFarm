import { test, expect, type BrowserContext } from "../support/browser-test";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
let fixtures: ProductionBrowserFixtures, officerOrg: string;
async function query(sql: string, params: unknown[] = []) {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await client.connect();
  try { return await client.query(sql, params); } finally { await client.end(); }
}
async function signIn(context: BrowserContext, who: "a" | "b") {
  await context.clearCookies();
  await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures(); officerOrg = crypto.randomUUID();
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Officer browser fixture\',\'ORGANIZATION\')', [officerOrg]);
  await query('INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,\'AGENT\')', [fixtures.users.b, officerOrg]);
  await signIn(context, "a");
});
test.afterEach(async () => {
  await query('DELETE FROM "OfficerAssignment" WHERE "tenantId"=$1 AND "officerId"=$2', [fixtures.tenants.a, fixtures.users.b]);
  await query('DELETE FROM "Membership" WHERE "organizationId"=$1', [officerOrg]);
  await query('DELETE FROM "Organization" WHERE id=$1', [officerOrg]);
});
test("owner consent grants one farm, dashboard shows actual counts, revocation removes it", async ({ page, context }, info) => {
  await page.goto(`/farms/${fixtures.farms.a}/officers`);
  await expect(page.getByRole("heading", { name: "Farm officer access" })).toBeVisible();
  await page.getByLabel("Officer account ID", { exact: true }).fill(fixtures.users.b);
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.getByRole("checkbox").first().focus(); await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Grant officer access", exact: true }).click();
  await expect(page.getByText("Officer access updated.", { exact: true })).toBeVisible();
  await signIn(context, "b"); await page.goto(`/agent?scope=${officerOrg}`);
  await expect(page.getByRole("heading", { name: "Browser farm A", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browser farm A2", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Browser farm B", exact: true })).toHaveCount(0);
  await expect(page.locator("dl").getByText("1", { exact: true })).toHaveCount(1);
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate(el => el.clientWidth));
  await page.screenshot({ path: `.cache/p14-dashboard-${info.project.name}.png`, fullPage: true });
  const money = await context.request.get(`/api/v1/farms/${fixtures.farms.a}/accounting/summary`);
  expect(money.status()).toBe(403);
  const exportFile = await context.request.get(`/api/v1/farms/${fixtures.farms.a}/export`);
  expect(exportFile.status()).toBe(403);
  await signIn(context, "a"); await page.goto(`/farms/${fixtures.farms.a}/officers`);
  await page.getByRole("checkbox").last().check();
  await page.getByRole("button", { name: "Remove officer access", exact: true }).click();
  await expect(page.getByText("Access removed", { exact: true })).toBeVisible();
  await signIn(context, "b"); await page.goto(`/agent?scope=${officerOrg}`);
  await expect(page.getByText(/No farms are currently assigned/)).toBeVisible();
});
test("unassigned dashboard exposes no farmer directory and guessed owner pages deny", async ({ page, context }) => {
  await signIn(context, "b"); await page.goto(`/agent?scope=${officerOrg}`);
  await expect(page.getByText(/No farms are currently assigned/)).toBeVisible();
  const response = await context.request.get(`/api/v1/agent/dashboard?scope=${officerOrg}&cursor=${fixtures.farmers.a}`);
  expect(response.status()).toBe(403);
  await page.goto(`/farms/${fixtures.farms.a}/officers`);
  await expect(page).toHaveURL(/\/forbidden/);
});
test("offline consent is disabled and typed details survive reconnect", async ({ page, context }) => {
  await page.goto(`/farms/${fixtures.farms.a}/officers`);
  await page.getByLabel("Officer account ID", { exact: true }).fill(fixtures.users.b);
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: "Grant officer access", exact: true })).toBeDisabled();
  await expect(page.getByText("Reconnect to grant access. Your form is still here.", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByLabel("Officer account ID", { exact: true })).toHaveValue(fixtures.users.b);
  await expect(page.getByRole("button", { name: "Grant officer access", exact: true })).toBeEnabled();
});
