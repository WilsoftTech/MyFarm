import { test, expect, type BrowserContext } from "../support/browser-test";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { outbox, PNG } from "../support/offline-browser";
let f: ProductionBrowserFixtures, org: string;
async function query(sql: string, values: unknown[] = []) { const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect(); try { return await db.query(sql, values); } finally { await db.end(); } }
async function signIn(context: BrowserContext, who: "a" | "b" | "admin") { await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]); }
test.beforeEach(async ({ context }) => {
  f = readProductionBrowserFixtures(); org = crypto.randomUUID();
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(f.sessions)]);
  await query('INSERT INTO "Organization"(id,name,kind) VALUES($1,\'Officer work UI\',\'ORGANIZATION\')', [org]);
  await query('INSERT INTO "Membership"("userId","organizationId",role) VALUES($1,$2,\'AGENT\')', [f.users.b, org]); await signIn(context, "b");
});
test.afterEach(async ({ context }) => {
  await context.setOffline(false);
  const farms = await query('SELECT "tenantId" FROM "Farmer" WHERE "userId"=$1', [f.users.admin]);
  await query('DELETE FROM "OfficerRegistrationDraft" WHERE "organizationId"=$1', [org]);
  const tenants = [f.tenants.a, ...farms.rows.map(row => row.tenantId)];
  for (const table of ["OfficerVisitPhoto", "OfficerFollowUp", "OfficerProblem", "OfficerVisit", "OfficerAssignment"]) await query(`DELETE FROM "${table}" WHERE "tenantId"=ANY($1::uuid[]) AND "officerId"=$2`, [tenants, f.users.b]);
  for (const row of farms.rows) {
    for (const table of ["FarmMember", "Farm", "AuditEvent"]) await query(`DELETE FROM "${table}" WHERE "tenantId"=$1`, [row.tenantId]);
    await query('DELETE FROM "FarmerProfile" WHERE "farmerId" IN(SELECT id FROM "Farmer" WHERE "userId"=$1)', [f.users.admin]);
    await query('DELETE FROM "Farmer" WHERE "userId"=$1', [f.users.admin]);
    await query('DELETE FROM "Membership" WHERE "organizationId"=$1', [row.tenantId]); await query('DELETE FROM "Organization" WHERE id=$1', [row.tenantId]);
  }
  await query('DELETE FROM "AuditEvent" WHERE "tenantId"=$1', [org]);
  await query('DELETE FROM "Membership" WHERE "organizationId"=$1', [org]); await query('DELETE FROM "Organization" WHERE id=$1', [org]);
});
test("officer prepares a draft; only the named farmer reviews and accepts the exact details", async ({ page, context }) => {
  await page.goto(`/agent?scope=${org}`);
  await page.getByRole("link", { name: "Prepare farmer registration", exact: true }).click();
  await page.getByLabel("Farmer account ID", { exact: true }).fill(f.users.admin);
  await page.getByLabel("Full name", { exact: true }).fill("Assisted browser farmer"); await page.getByLabel("Phone number", { exact: true }).fill("0772123456");
  await page.getByLabel("District", { exact: true }).fill("Rukungiri"); await page.getByLabel("How do you hold your farm land?", { exact: true }).selectOption("OWNED");
  await page.getByRole("checkbox", { name: "Crops", exact: true }).check(); await page.getByRole("button", { name: "Continue to farm details" }).click();
  await page.getByLabel("Farm name", { exact: true }).fill("Assisted browser farm"); await page.getByLabel("District", { exact: true }).fill("Rukungiri");
  await page.getByLabel("How is this land held?", { exact: true }).selectOption("OWNED"); await page.getByLabel("Main activity on this farm", { exact: true }).selectOption("CROPS");
  await page.getByRole("button", { name: "Save draft for farmer review" }).click();
  const link = page.getByRole("link", { name: /\/registration-review\// }); await expect(link).toBeVisible(); const path = await link.getAttribute("href"); expect(path).toBeTruthy();
  expect((await query('SELECT id FROM "Farmer" WHERE "userId"=$1', [f.users.admin])).rowCount).toBe(0);
  await page.getByRole("link", { name: "Open sync center", exact: true }).click();
  await expect.poll(async () => (await outbox(page, f.users.b)).filter(row => row.operation === "OFFICER_PREPARE_REGISTRATION" && row.syncStatus === "SYNCED").length).toBe(1);
  await signIn(context, "a"); await page.goto(path!); await expect(page).toHaveURL(/\/forbidden/);
  await signIn(context, "admin"); await page.goto(path!);
  await expect(page.getByRole("heading", { name: "Review registration" })).toBeVisible();
  await expect(page.getByText("Assisted browser farmer", { exact: true })).toBeVisible(); await expect(page.getByText("Assisted browser farm", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept registration" })).toBeDisabled();
  await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Accept registration" }).click();
  await expect(page).toHaveURL(/\/farms\/[0-9a-f-]+$/); await expect(page.getByRole("heading", { name: "Assisted browser farm" })).toBeVisible();
  await page.goto(path!); await expect(page.getByRole("heading", { name: "Registration accepted" })).toBeVisible();
  expect((await query('SELECT id FROM "Farmer" WHERE "userId"=$1', [f.users.admin])).rowCount).toBe(1);
});
test("offline visit and photo survive reload, sync once, and revoked work stays recoverable", async ({ page, context }) => {
  await signIn(context, "a");
  const granted = await context.request.post(`/api/v1/farms/${f.farms.a}/officers`, { headers: { origin: "http://127.0.0.1:3102" }, data: { requestId: crypto.randomUUID(), officerId: f.users.b, permissions: ["DASHBOARD", "VISITS", "FOLLOW_UPS"], confirmed: true } }); expect(granted.ok()).toBe(true);
  const { assignmentId } = await granted.json(); await signIn(context, "b"); await page.goto(`/agent?scope=${org}`);
  await expect(page.getByText("Assigned farms saved on this phone.", { exact: true })).toBeVisible();
  await page.waitForFunction(async () => !!(await caches.match("/offline")));
  await page.goto("/offline"); await expect(page.getByRole("heading", { name: "Officer visits offline" })).toBeVisible();
  await context.setOffline(true); await page.reload();
  await page.getByLabel("Visit date", { exact: true }).fill("2026-11-21"); await page.getByLabel("Visit completed", { exact: true }).check();
  await page.getByLabel("Observations", { exact: true }).fill("Offline crop inspection"); await page.getByLabel("Follow-up date (optional)", { exact: true }).fill("2026-11-23");
  await page.getByLabel("Visit photo (optional)", { exact: true }).setInputFiles({ name: "visit.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Save visit on this phone" }).click(); await expect(page.getByText("Visit and photo saved on this phone. Waiting to send.")).toBeVisible();
  await page.reload(); expect((await outbox(page, f.users.b)).filter(row => row.operation.startsWith("OFFICER_")).length).toBe(2);
  await context.setOffline(false); await page.getByRole("button", { name: "Send now", exact: true }).click();
  await expect.poll(async () => (await outbox(page, f.users.b)).filter(row => row.operation.startsWith("OFFICER_") && row.syncStatus === "SYNCED").length).toBe(2);
  await page.getByRole("button", { name: "Send now", exact: true }).click(); expect((await query('SELECT id FROM "OfficerVisit" WHERE "assignmentId"=$1', [assignmentId])).rowCount).toBe(1);
  expect((await query('SELECT id FROM "OfficerVisitPhoto" WHERE "farmId"=$1 AND "uploadedAt" IS NOT NULL', [f.farms.a])).rowCount).toBe(1);
  await context.setOffline(true); await page.getByLabel("Visit date", { exact: true }).fill("2026-11-22"); await page.getByRole("button", { name: "Save visit on this phone" }).click();
  await expect(page.getByText("Saved on this phone. Waiting to send.", { exact: true })).toBeVisible();
  await query('UPDATE "OfficerAssignment" SET "revokedAt"=now(),version=version+1 WHERE id=$1', [assignmentId]);
  await context.setOffline(false); await page.getByRole("button", { name: "Send now", exact: true }).click();
  await expect(page.getByText("Access may have changed. Your draft and photo remain on this phone. Ask the farmer to restore access, then retry.")).toBeVisible();
  await page.reload(); expect((await outbox(page, f.users.b)).filter(row => row.operation === "OFFICER_RECORD_VISIT" && row.syncStatus === "FAILED")).toHaveLength(1);
  await expect(page.getByRole("button", { name: "Download a copy" })).toBeVisible();
});
