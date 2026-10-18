import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";

let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await client.connect();
  try { return await client.query(sql, values); } finally { await client.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies();
  await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
async function enterprise(page: Page, name: string, type = "CROP", farm = fixtures.farms.a) {
  await page.goto(`/farms/${farm}/enterprises/new`);
  await page.getByLabel("Enterprise name").fill(name); await page.getByLabel("Enterprise type").selectOption(type);
  await page.getByRole("button", { name: "Save enterprise" }).click();
  await expect(page.getByRole("status")).toHaveText("Enterprise saved.");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const row = (await query('SELECT id FROM "Enterprise" WHERE "farmId" = $1 AND name = $2', [farm, name])).rows[0];
  expect(typeof row.id).toBe("string"); return String(row.id);
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  for (const table of ["CropCycle", "PoultryBatch", "Enterprise", "Season"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after = NULL WHERE id = ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status = \'ACTIVE\' WHERE "userId" = $1', [fixtures.users.a]);
  await identity(context, "a");
});

test("farm → empty production lists → enterprise and overlapping seasons → correct farm histories", async ({ page }, testInfo) => {
  await page.goto(`/farms/${fixtures.farms.a}`);
  await page.getByRole("link", { name: "Enterprises", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No enterprises yet" })).toBeVisible();
  await expect(page.getByText("Farm: Browser farm A", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Add enterprise" }).click();
  await page.getByRole("button", { name: "Save enterprise" }).click();
  await expect(page.getByLabel("Enterprise name")).toBeFocused();
  await expect(page.getByText("Enter an enterprise name.")).toBeVisible();
  const maize = await enterprise(page, "Maize");
  await enterprise(page, "Coffee");
  await enterprise(page, "Layers", "POULTRY");
  await expect(page.getByText("Poultry batch records are not available yet.", { exact: false })).toBeVisible();
  for (const label of ["2026 Season A", "2026 Season B"]) {
    await page.goto(`/farms/${fixtures.farms.a}/seasons/new`);
    await page.getByLabel("Season name").fill(label); await page.getByLabel("Start date", { exact: true }).fill("2026-03-01");
    await page.getByLabel("End date (optional)").fill("2026-08-01");
    await page.getByRole("button", { name: "Save season" }).click();
    await expect(page.getByRole("status")).toHaveText("Season saved.");
    await expect(page.getByRole("heading", { name: label, exact: true })).toBeVisible();
  }
  await page.getByRole("navigation", { name: "Farm production" }).getByRole("link", { name: "Seasons", exact: true }).click();
  const seasons = page.getByRole("list", { name: "Seasons on this farm" });
  await expect(seasons.getByRole("listitem")).toHaveCount(2);
  await expect(seasons).toContainText("2026 Season A"); await expect(seasons).toContainText("2026 Season B");
  await page.goto(`/farms/${fixtures.farms.a2}/enterprises`);
  await expect(page.getByRole("heading", { name: "No enterprises yet" })).toBeVisible();
  await expect(page.getByText("Farm: Browser farm A2", { exact: true })).toBeVisible();
  await page.goto(`/farms/${fixtures.farms.a2}/seasons`);
  await expect(page.getByRole("heading", { name: "No seasons yet" })).toBeVisible();
  await page.goto(`/farms/${fixtures.farms.a2}/enterprises/${maize}`);
  await expect(page).toHaveURL(/\/forbidden$/); await expect(page.getByText("Maize", { exact: true })).toHaveCount(0);
  await page.goto(`/farms/${fixtures.farms.a}/enterprises`);
  await expect(page.getByRole("list", { name: "Enterprises on this farm" }).getByRole("listitem")).toHaveCount(3);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  mkdirSync(".cache/t003-visual", { recursive: true });
  await page.screenshot({ path: `.cache/t003-visual/enterprises-${testInfo.project.name}.png`, fullPage: true });
});

test("offline save remains on the open form and succeeds exactly once after reconnecting", async ({ context, page }, testInfo) => {
  await page.goto(`/farms/${fixtures.farms.a}/enterprises/new`);
  await page.getByLabel("Enterprise name").fill("Offline draft"); await page.getByLabel("Enterprise type").selectOption("CROP");
  await context.setOffline(true);
  await expect(page.getByRole("status")).toContainText("You are offline");
  await expect(page.getByRole("button", { name: "Save enterprise" })).toBeDisabled();
  expect((await query('SELECT count(*)::int AS count FROM "Enterprise" WHERE "farmId" = $1', [fixtures.farms.a])).rows[0].count).toBe(0);
  await context.setOffline(false);
  await expect(page.getByLabel("Enterprise name")).toHaveValue("Offline draft");
  await expect(page.getByRole("button", { name: "Save enterprise" })).toBeEnabled();
  await page.getByRole("button", { name: "Save enterprise" }).click();
  await expect(page.getByRole("status")).toHaveText("Enterprise saved.");
  expect((await query('SELECT count(*)::int AS count FROM "Enterprise" WHERE "farmId" = $1 AND name = $2', [fixtures.farms.a, "Offline draft"])).rows[0].count).toBe(1);
  await page.goto(`/farms/${fixtures.farms.a}/seasons/new`);
  await expect(page.getByLabel("Season name")).toBeVisible();
  mkdirSync(".cache/t003-visual", { recursive: true });
  await page.screenshot({ path: `.cache/t003-visual/season-form-${testInfo.project.name}.png`, fullPage: true });
});

test("a lost response after commit retries the same intent without duplicating the record", async ({ page }) => {
  await page.goto(`/farms/${fixtures.farms.a}/enterprises/new`);
  await page.getByLabel("Enterprise name").fill("Lost response"); await page.getByLabel("Enterprise type").selectOption("CROP");
  let interrupted = false;
  await page.route(`**/farms/${fixtures.farms.a}/enterprises/new`, async route => {
    if (route.request().method() === "POST" && !interrupted) {
      interrupted = true; await route.fetch(); await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save enterprise" }).click();
  await expect(page.locator("form[aria-busy]").getByRole("alert")).toContainText("Connection interrupted");
  await expect(page.getByLabel("Enterprise name")).toHaveValue("Lost response");
  await page.getByRole("button", { name: "Save enterprise" }).click();
  await expect(page.getByRole("status")).toHaveText("Enterprise saved.");
  const rows = (await query('SELECT id FROM "Enterprise" WHERE "farmId" = $1 AND name = $2', [fixtures.farms.a, "Lost response"])).rows;
  expect(rows).toHaveLength(1);
  expect((await query('SELECT count(*)::int AS count FROM "AuditEvent" WHERE action = \'ENTERPRISE_CREATED\' AND "targetId" = $1', [rows[0].id])).rows[0].count).toBe(1);
});

test("another user and ADMIN cannot view farm production, even with guessed nested URLs", async ({ page, context }) => {
  const record = await enterprise(page, "Private maize");
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const suffix of ["enterprises", "enterprises/new", "enterprises/" + record, "seasons", "seasons/new"]) {
      await page.goto(`/farms/${fixtures.farms.a}/${suffix}`); await expect(page).toHaveURL(/\/forbidden$/);
      await expect(page.getByText("Private maize", { exact: true })).toHaveCount(0);
    }
  }
});

test("membership revoked after the form opens denies the action and retains the farmer's input", async ({ page }) => {
  await page.goto(`/farms/${fixtures.farms.a}/enterprises/new`);
  await page.getByLabel("Enterprise name").fill("Revoked save"); await page.getByLabel("Enterprise type").selectOption("CROP");
  await query('UPDATE "FarmMember" SET status = \'REVOKED\' WHERE "farmId" = $1 AND "userId" = $2', [fixtures.farms.a, fixtures.users.a]);
  await page.getByRole("button", { name: "Save enterprise" }).click();
  await expect(page.locator("form[aria-busy]").getByRole("alert")).toHaveText("You do not have access to this record.");
  await expect(page.getByLabel("Enterprise name")).toHaveValue("Revoked save");
  expect((await query('SELECT count(*)::int AS count FROM "Enterprise" WHERE "farmId" = $1', [fixtures.farms.a])).rows[0].count).toBe(0);
});

test("expired server sessions cannot open the production forms", async ({ page }) => {
  await query("UPDATE auth.sessions SET not_after = now() - interval '1 minute' WHERE id = $1", [fixtures.sessions.a]);
  await page.goto(`/farms/${fixtures.farms.a}/seasons/new`);
  await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
  await expect(page.getByLabel("Season name")).toHaveCount(0);
});

test("an unsupported enterprise type is saved with clear limits and no dead workflow controls", async ({ page }) => {
  await enterprise(page, "Dairy plans", "DAIRY");
  await expect(page.getByText("Production records for this enterprise type are not available yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /start|record production/i })).toHaveCount(0);
  await expect(page.getByText("Dairy", { exact: true })).toBeVisible();
});

test("list pagination works on both production lists without crossing farms", async ({ page }) => {
  for (let n = 0; n < 21; n++) {
    await query('INSERT INTO "Enterprise" (id, "tenantId", "farmId", type, name, "createdBy") VALUES ($1, $2, $3, \'CROP\', $4, $5)', [randomUUID(), fixtures.tenants.a, fixtures.farms.a, "Page " + n, fixtures.users.a]);
    await query('INSERT INTO "Season" (id, "tenantId", "farmId", label, "startDate", "createdBy") VALUES ($1, $2, $3, $4, $5, $6)', [randomUUID(), fixtures.tenants.a, fixtures.farms.a, "Period " + n, "2026-01-01", fixtures.users.a]);
  }
  for (const resource of ["enterprises", "seasons"]) {
    await page.goto(`/farms/${fixtures.farms.a}/${resource}`);
    await expect(page.getByRole("listitem")).toHaveCount(20);
    await page.getByRole("link", { name: "More records" }).click();
    await expect(page.getByRole("listitem")).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`/farms/${fixtures.farms.a}/${resource}\\?cursor=`));
    await page.getByRole("link", { name: "First page" }).click();
    await expect(page.getByRole("listitem")).toHaveCount(20);
  }
});

test("provider failure is recoverable and is never shown as an empty season list", async ({ page }) => {
  await query('REVOKE SELECT ON "Season" FROM myfarm_runtime');
  try {
    await page.goto(`/farms/${fixtures.farms.a}/seasons`);
    await expect(page.getByRole("heading", { name: "We could not load this page" })).toBeVisible();
    await expect(page.getByText("No seasons yet", { exact: true })).toHaveCount(0);
  } finally { await query('GRANT SELECT ON "Season" TO myfarm_runtime'); }
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "No seasons yet" })).toBeVisible();
});
