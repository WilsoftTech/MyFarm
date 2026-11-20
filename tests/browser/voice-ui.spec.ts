import { expect, test, type Page } from "../support/browser-test";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { clearInventoryBrowser } from "../support/inventory-browser";
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await client.connect();
  try { return await client.query(sql, values); } finally { await client.end(); }
}
async function fill(page: Page, amount = "180000") {
  await page.goto(`/farms/${fixtures.farms.a}/voice`);
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Feed" });
  await page.getByLabel("Amount", { exact: true }).fill(amount);
  await page.getByLabel("Date", { exact: true }).fill("2026-11-20");
  await page.getByRole("button", { name: "Review expense", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check this expense" })).toBeVisible();
}
const count = async () => (await query('SELECT count(*)::int AS n FROM "AccountingRecord" WHERE "farmId" = $1', [fixtures.farms.a])).rows[0].n;
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures(); await clearInventoryBrowser(fixtures);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
});
test("AC001 reviews the source total, creates nothing until confirmed, and opens the one saved expense", async ({ page }, testInfo) => {
  await fill(page); await expect(page.getByText("UGX 180,000", { exact: true })).toBeVisible(); expect(await count()).toBe(0);
  await expect(page.getByRole("button", { name: "Confirm expense", exact: true })).toBeDisabled();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate(el => el.clientWidth));
  await page.screenshot({ path: ".cache/phase12-complete/review-" + testInfo.project.name + ".png", fullPage: true });
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Expense saved" })).toBeVisible(); expect(await count()).toBe(1);
  await page.getByRole("link", { name: "Open saved expense" }).click(); await expect(page.getByText("UGX 180,000", { exact: true }).first()).toBeVisible();
});
test("AC001 a mistaken amount must be reviewed again and discarding posts no expense", async ({ page }) => {
  await fill(page, "18000");
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("180000"); await page.getByRole("button", { name: "Review expense", exact: true }).click();
  await expect(page.getByText("UGX 180,000", { exact: true })).toBeVisible(); await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", { name: "Discard review" }).click(); await expect(page.getByLabel("Amount", { exact: true })).toHaveValue(""); expect(await count()).toBe(0);
});
test("AC002 a lost response is retried as the same confirmation, with one financial effect", async ({ page }) => {
  await fill(page);
  await page.route("**/voice/drafts/*/confirm", async route => { await route.fetch(); await route.abort("failed"); }, { times: 1 });
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry this confirmation" })).toBeVisible(); expect(await count()).toBe(1);
  await expect(page.getByRole("button", { name: "Edit details" })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Expense saved" })).toBeVisible(); expect(await count()).toBe(1);
});
test("AC002 a pending review resumes after refresh but never carries confirmation consent", async ({ page }) => {
  await fill(page); await page.getByRole("checkbox").check(); await page.reload();
  await expect(page.getByRole("heading", { name: "Check this expense" })).toBeVisible(); await expect(page.getByRole("checkbox")).not.toBeChecked(); expect(await count()).toBe(0);
});
test("AC002 retrying the same confirmation response remains available", async ({ page }) => {
  await fill(page);
  await page.route("**/voice/drafts/*/confirm", async route => { await route.fetch(); await route.abort("failed"); }, { times: 1 });
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry this confirmation" })).toBeVisible();
  await page.getByRole("button", { name: "Retry this confirmation" }).click();
  await expect(page.getByRole("heading", { name: "Expense saved" })).toBeVisible(); expect(await count()).toBe(1);
});
test("AC002 access revoked after review prevents confirmation", async ({ page }) => {
  await fill(page);
  await query('UPDATE "FarmMember" SET status=\'REVOKED\' WHERE "userId"=$1', [fixtures.users.a]);
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your access to this farm has changed" })).toBeVisible(); expect(await count()).toBe(0);
});
test("AC002 editing invalidates a copied confirmation and expiry requires fresh review", async ({ page, context }) => {
  await page.clock.install();
  await fill(page);
  const prior = (await query('SELECT id, "requestId", version, "payloadHash" FROM "VoiceExpenseDraft" WHERE "farmId"=$1', [fixtures.farms.a])).rows[0];
  await page.getByRole("button", { name: "Edit details" }).click(); await page.getByLabel("Currency", { exact: true }).fill("USD");
  await page.getByRole("button", { name: "Review expense", exact: true }).click(); await expect(page.getByText("USD 180,000", { exact: true })).toBeVisible();
  const stale = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/voice/drafts/${prior.id}/confirm`, {
    headers: { origin: "http://127.0.0.1:3102" }, data: { confirmed: true, requestId: prior.requestId, version: prior.version, payloadHash: prior.payloadHash },
  });
  expect(stale.status()).toBe(409); expect(await count()).toBe(0);
  await page.clock.fastForward(31 * 60 * 1000);
  await expect(page.getByText("This review has expired. Review the details again before saving.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm expense", exact: true })).toBeDisabled();
});
test("AC002 an expired session cannot commit, and offline review keeps input for reconnect", async ({ page, context }) => {
  await fill(page); await context.setOffline(true);
  await expect(page.getByRole("button", { name: "Confirm expense", exact: true })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "You are offline. Your details stay here" }).getByRole("link", { name: "Offline work", exact: true })).toBeVisible();
  await context.setOffline(false);
  await query('UPDATE auth.sessions SET not_after=now()-interval \'1 minute\' WHERE id=$1', [fixtures.sessions.a]);
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Your sign-in has expired" })).toBeVisible(); expect(await count()).toBe(0);
});
test("AC003 language choices promise no speech and fall back to text; the source example reviews two bags as one total", async ({ page, context }) => {
  await page.goto(`/farms/${fixtures.farms.a}/voice`);
  await expect(page.getByRole("button", { name: "Speech unavailable — use text" })).toBeDisabled();
  const capabilities = await context.request.get(`/api/v1/farms/${fixtures.farms.a}/voice/capabilities`);
  expect(capabilities.status()).toBe(200);
  const result = await capabilities.json(); expect(result.retainsAudio).toBe(false);
  expect(result.languages.every((language: { speechAvailable: boolean }) => !language.speechAvailable)).toBe(true);
  for (const language of ["nyn", "lg", "sw"]) {
    await page.getByLabel("Speech language", { exact: true }).selectOption(language);
    await page.getByRole("button", { name: "Use example", exact: true }).click(); await page.getByRole("button", { name: "Fill from words", exact: true }).click();
    await expect(page.getByText("These words cannot be filled in automatically. Enter or correct the expense details below instead.")).toBeVisible();
  }
  await page.getByLabel("Speech language", { exact: true }).selectOption("en");
  await page.getByLabel("Category", { exact: true }).selectOption({ label: "Feed" }); await page.getByLabel("Date", { exact: true }).fill("2026-11-20");
  await page.getByRole("button", { name: "Fill from words", exact: true }).click(); await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("180000");
  await page.getByRole("button", { name: "Review expense", exact: true }).click();
  await expect(page.getByText("UGX 180,000", { exact: true })).toBeVisible(); await expect(page.getByText("2 bags are a description only.", { exact: false })).toBeVisible(); expect(await count()).toBe(0);
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Expense saved" })).toBeVisible(); expect(await count()).toBe(1);
});
test("AC002 editing a review already confirmed in another window recovers its receipt instead of posting a duplicate", async ({ page, context }) => {
  await fill(page); const second = await context.newPage();
  try {
    await second.goto(page.url()); await expect(second.getByRole("heading", { name: "Check this expense" })).toBeVisible();
    await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Confirm expense", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Expense saved" })).toBeVisible();
    await second.getByRole("button", { name: "Edit details" }).click(); await second.getByLabel("Amount", { exact: true }).fill("90000");
    await second.getByRole("button", { name: "Review expense", exact: true }).click();
    await expect(second.getByText("This review was already saved. Your edits were not posted. Open the saved expense before correcting it.")).toBeVisible(); expect(await count()).toBe(1);
  } finally { await second.close(); }
});
