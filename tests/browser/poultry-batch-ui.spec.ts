import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
const chicken = "f4030008-0000-4000-8000-000000000004";
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
async function setup(context: BrowserContext, farm = fixtures.farms.a, name = "Layers") {
  const response = await context.request.post(`/api/v1/farms/${farm}/enterprises`, { headers: { origin: "http://127.0.0.1:3102" }, data: { requestId: id(), name, type: "POULTRY" } });
  expect(response.status()).toBe(201);
  return { enterpriseId: z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await response.json()).enterprise.enterpriseId, farm };
}
async function fill(page: Page, parents: Awaited<ReturnType<typeof setup>>, label = "Batch #004", quantity = "100") {
  await page.getByLabel("Enterprise", { exact: true }).selectOption(parents.enterpriseId);
  await page.getByLabel("Batch name", { exact: true }).fill(label);
  await page.getByLabel("Animal type", { exact: true }).selectOption({ label: "Chicken" });
  await page.getByLabel("Production purpose", { exact: true }).selectOption({ label: "Eggs (layers)" });
  await page.getByLabel("Starting number of birds", { exact: true }).fill(quantity);
  await page.getByLabel("Acquisition date", { exact: true }).fill("2026-03-01");
}
async function save(page: Page) {
  await page.getByRole("button", { name: "Save poultry batch" }).click();
  await expect(page.getByRole("status")).toHaveText("Poultry batch saved.");
}
const alert = (page: Page) => page.locator("form[aria-busy]").getByRole("alert");
const batches = async (enterpriseId: string) => (await query('SELECT count(*)::int AS n FROM "PoultryBatch" WHERE "enterpriseId"=$1', [enterpriseId])).rows[0].n;
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  for (const table of ["CropCycle", "PoultryBatch", "Enterprise", "Season", "Plot"]) await query(`DELETE FROM "${table}" WHERE "tenantId"=ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "a");
});
test("empty/setup states → batch with whole count and provenance → separate farm histories", async ({ page, context }, info) => {
  const farm = fixtures.farms.a;
  await page.goto(`/farms/${farm}`); await page.getByRole("link", { name: "Poultry batches", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No poultry batches yet" })).toBeVisible();
  await page.getByRole("link", { name: "Add poultry batch" }).click();
  await expect(page.getByRole("heading", { name: "Set up this farm before adding a batch" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add enterprise" })).toHaveAttribute("href", `/farms/${farm}/enterprises/new`);
  const parents = await setup(context);
  await page.goto(`/farms/${farm}/enterprises/${parents.enterpriseId}`);
  await page.getByRole("link", { name: "Add poultry batch" }).click();
  await expect(page.getByLabel("Enterprise", { exact: true })).toHaveValue(parents.enterpriseId);
  await page.getByRole("button", { name: "Save poultry batch" }).click();
  await expect(page.getByLabel("Batch name", { exact: true })).toBeFocused();
  await fill(page, parents, "Batch #004", "12.5");
  await page.getByRole("button", { name: "Save poultry batch" }).click();
  await expect(page.getByText("Enter the number of birds as a whole number, 0 or more.")).toBeVisible();
  await expect(page.getByLabel("Starting number of birds", { exact: true })).toBeFocused();
  await page.getByLabel("Starting number of birds", { exact: true }).fill("1200");
  await page.getByLabel("Breed (optional)").fill("Kuroiler");
  mkdirSync(".cache/t009-visual", { recursive: true });
  await page.screenshot({ path: `.cache/t009-visual/poultry-form-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await save(page);
  await expect(page.getByRole("heading", { name: "Batch #004" })).toBeVisible();
  await expect(page.getByText("1,200 birds", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/This is the starting number\. Purchases, deaths and sales cannot be recorded yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Layers", exact: true })).toHaveAttribute("href", `/farms/${farm}/enterprises/${parents.enterpriseId}`);
  await expect(page.getByText("Eggs (layers)", { exact: true })).toBeVisible(); await expect(page.getByText("Kuroiler", { exact: true })).toBeVisible();
  await page.screenshot({ path: `.cache/t009-visual/poultry-detail-${info.project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto(`/farms/${farm}/poultry-batches/new`); await fill(page, parents, "Empty house", "0"); await save(page);
  await expect(page.getByText("0 birds", { exact: true }).first()).toBeVisible(); await expect(page.getByText("Not recorded", { exact: true })).toBeVisible();
  const other = await setup(context, fixtures.farms.a2, "Second farm layers");
  await page.goto(`/farms/${other.farm}/poultry-batches/new`); await fill(page, other); await save(page);
  await page.goto(`/farms/${farm}/poultry-batches`); await expect(page.getByRole("list", { name: "Poultry batches on this farm" }).getByRole("listitem")).toHaveCount(2);
  await page.goto(`/farms/${other.farm}/poultry-batches`); await expect(page.getByRole("list", { name: "Poultry batches on this farm" }).getByRole("listitem")).toHaveCount(1);
});
test("a duplicate batch name on the farm fails without an effect, keeps the draft, then saves when renamed", async ({ page, context }) => {
  const parents = await setup(context), second = await setup(context, fixtures.farms.a, "Broilers"), path = `/farms/${parents.farm}/poultry-batches/new`;
  await page.goto(path); await fill(page, parents, "Batch #004"); await save(page);
  await page.goto(path); await fill(page, second, "  batch   #004 ");
  await page.getByLabel("Production purpose", { exact: true }).selectOption({ label: "Meat (broilers)" });
  await page.getByRole("button", { name: "Save poultry batch" }).click();
  await expect(alert(page)).toContainText("already use this name");
  await expect(page.getByLabel("Batch name", { exact: true })).toHaveValue("  batch   #004 ");
  expect(await batches(second.enterpriseId)).toBe(0);
  await page.getByLabel("Batch name", { exact: true }).fill("Batch #005"); await save(page);
  await expect(page.getByText("Meat (broilers)", { exact: true })).toBeVisible();
  expect(await batches(second.enterpriseId)).toBe(1);
});
test("offline open form reconnects without losing details or creating duplicate batches", async ({ page, context }) => {
  const parents = await setup(context);
  await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await fill(page, parents);
  await context.setOffline(true);
  try { await expect(page.getByRole("button", { name: "Save poultry batch" })).toBeDisabled(); await expect(page.getByText(/You are offline/)).toBeVisible(); await expect(page.getByLabel("Starting number of birds", { exact: true })).toHaveValue("100"); }
  finally { await context.setOffline(false); }
  await save(page); expect(await batches(parents.enterpriseId)).toBe(1);
});
test("lost response after committing a batch retries exactly once with its original request identity", async ({ page, context }) => {
  const parents = await setup(context);
  await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await fill(page, parents);
  let interrupted = false;
  await page.route("**/poultry-batches/new", async route => {
    if (route.request().method() === "POST" && !interrupted) { interrupted = true; await route.fetch(); await route.abort("failed"); }
    else await route.continue();
  });
  await page.getByRole("button", { name: "Save poultry batch" }).click();
  await expect(alert(page)).toContainText("Connection interrupted");
  await save(page);
  const rows = (await query('SELECT id FROM "PoultryBatch" WHERE "enterpriseId"=$1', [parents.enterpriseId])).rows; expect(rows).toHaveLength(1);
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "targetId"=$1 AND action=\'POULTRY_BATCH_STARTED\'', [rows[0].id])).rows[0].n).toBe(1);
});
test("nested farm links, foreign presets and other users deny access; revocation retains an unsaved draft", async ({ page, context }) => {
  const parents = await setup(context); await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await fill(page, parents); await save(page);
  const detail = new URL(page.url()).pathname, batchId = detail.split("/").at(-1);
  await page.goto(`/farms/${fixtures.farms.a2}/poultry-batches/${batchId}`); await expect(page).toHaveURL(/\/forbidden$/);
  await page.goto(`/farms/${fixtures.farms.a2}/poultry-batches/new?enterpriseId=${parents.enterpriseId}`); await expect(page).toHaveURL(/\/forbidden$/);
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const path of [`/farms/${parents.farm}/poultry-batches`, `/farms/${parents.farm}/poultry-batches/new`, detail]) { await page.goto(path); await expect(page).toHaveURL(/\/forbidden$/); }
  }
  await identity(context, "a"); await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await fill(page, parents, "Batch #005");
  await query('UPDATE "FarmMember" SET status=\'REVOKED\' WHERE "farmId"=$1 AND "userId"=$2', [parents.farm, fixtures.users.a]);
  try { await page.getByRole("button", { name: "Save poultry batch" }).click(); await expect(alert(page)).toContainText("You do not have access"); await expect(page.getByLabel("Batch name", { exact: true })).toHaveValue("Batch #005"); }
  finally { await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "farmId"=$1 AND "userId"=$2', [parents.farm, fixtures.users.a]); }
  expect(await batches(parents.enterpriseId)).toBe(1);
});
test("provider failures remain errors, recover with retry, and never imply a saved record", async ({ page, context }) => {
  const parents = await setup(context), path = `/farms/${parents.farm}/poultry-batches/new`;
  await query('REVOKE SELECT ON "AnimalTypeCatalog" FROM myfarm_runtime');
  try { await page.goto(path); await expect(page.getByRole("heading", { name: "We could not load this page" })).toBeVisible(); await expect(page.getByText("No animal types are available to choose.", { exact: false })).toHaveCount(0); }
  finally { await query('GRANT SELECT ON "AnimalTypeCatalog" TO myfarm_runtime'); }
  await page.getByRole("button", { name: "Try again" }).click(); await expect(page.getByLabel("Enterprise", { exact: true })).toBeVisible(); await fill(page, parents);
  await query('REVOKE INSERT ON "PoultryBatch" FROM myfarm_runtime');
  try {
    await page.getByRole("button", { name: "Save poultry batch" }).click(); await expect(alert(page)).toContainText("MyFarm is unavailable");
    await expect(page.getByLabel("Starting number of birds", { exact: true })).toHaveValue("100"); expect(await batches(parents.enterpriseId)).toBe(0);
  } finally { await query('GRANT INSERT ON "PoultryBatch" TO myfarm_runtime'); }
  await save(page);
});
test("later enterprise choices preserve the draft and batch list pagination stays scoped", async ({ page, context }) => {
  const parents = await setup(context);
  await query('UPDATE "Enterprise" SET "createdAt"=\'2000-01-01\' WHERE id=$1', [parents.enterpriseId]);
  for (let n = 0; n < 21; n++) await query('INSERT INTO "Enterprise" (id,"tenantId","farmId",name,type,"createdBy") VALUES ($1,$2,$3,$4,\'POULTRY\',$5)', [id(), fixtures.tenants.a, parents.farm, "Choice flock " + n, fixtures.users.a]);
  await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await page.getByLabel("Breed (optional)").fill("Draft retained");
  await page.getByRole("button", { name: "More enterprise choices" }).click(); await expect(page.getByRole("button", { name: "More enterprise choices" })).toHaveCount(0);
  await expect(page.getByLabel("Breed (optional)")).toHaveValue("Draft retained"); await fill(page, parents); await save(page);
  for (let n = 0; n < 20; n++) await query('INSERT INTO "PoultryBatch" (id,"tenantId","farmId","enterpriseId","animalTypeId","animalTypeName","batchLabel","batchLabelKey","startingQuantity","acquisitionDate",purpose,"createdBy") VALUES ($1,$2,$3,$4,$5,\'Chicken\',$6,$7,1,\'2026-03-01\',\'EGGS\',$8)', [id(), fixtures.tenants.a, parents.farm, parents.enterpriseId, chicken, "Page " + n, "page " + n, fixtures.users.a]);
  await query('UPDATE "PoultryBatch" SET "createdAt"=\'2026-03-01\' WHERE "farmId"=$1', [parents.farm]);
  await page.goto(`/farms/${parents.farm}/poultry-batches`); await expect(page.getByRole("list", { name: "Poultry batches on this farm" }).getByRole("listitem")).toHaveCount(20);
  await page.getByRole("link", { name: "More records" }).click(); await expect(page.getByRole("list", { name: "Poultry batches on this farm" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("link", { name: "First page" }).click(); await expect(page.getByRole("list", { name: "Poultry batches on this farm" }).getByRole("listitem")).toHaveCount(20);
});
test("closed or crop-only enterprises block setup; expired sessions cannot open it", async ({ page, context }) => {
  const parents = await setup(context);
  await query('UPDATE "Enterprise" SET status=\'CLOSED\' WHERE id=$1', [parents.enterpriseId]);
  await context.request.post(`/api/v1/farms/${parents.farm}/enterprises`, { headers: { origin: "http://127.0.0.1:3102" }, data: { requestId: id(), name: "Maize", type: "CROP" } });
  await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await expect(page.getByRole("heading", { name: "Set up this farm before adding a batch" })).toBeVisible();
  await page.goto(`/farms/${parents.farm}/enterprises/${parents.enterpriseId}`); await expect(page.getByRole("link", { name: "Add poultry batch" })).toHaveCount(0);
  await query('UPDATE auth.sessions SET not_after=now()-interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  await page.goto(`/farms/${parents.farm}/poultry-batches/new`); await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
});
