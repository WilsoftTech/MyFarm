import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";

/** P09-T003 / MYF-P09-AC001: the pilot journey for a farmer and pilot staff, on desktop and mobile. */
const id = () => crypto.randomUUID();
const base = "http://127.0.0.1:3102", origin = { origin: base };
const feed = "f4040002-0000-4000-8000-000000000112";
let fixtures: ProductionBrowserFixtures, staffOrg = "";
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: base, httpOnly: true, sameSite: "Lax", secure: false }]);
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
const day = (offset: number) => new Date(Date.now() + 3 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);
async function clearPilot() {
  for (const table of ["SupportIncident", "PilotPrompt", "PilotParticipation", "PilotCohort"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = $1::uuid`, [staffOrg]);
  await query('DELETE FROM "PilotUsageEvent" WHERE "tenantId" = ANY($1::uuid[])', [Object.values(fixtures.tenants)]);
}

test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  // Pilot staff are ADMIN of a real ORGANIZATION (D-P09-007); the fixture admin gets one for this spec.
  staffOrg = (await query(`SELECT id FROM "Organization" WHERE name = 'Pilot browser team' LIMIT 1`)).rows[0]?.id ?? id();
  await query(`INSERT INTO "Organization" (id, name, kind) VALUES ($1, 'Pilot browser team', 'ORGANIZATION') ON CONFLICT (id) DO NOTHING`, [staffOrg]);
  await query(`INSERT INTO "Membership" ("userId", "organizationId", role) VALUES ($1, $2, 'ADMIN') ON CONFLICT DO NOTHING`, [fixtures.users.admin, staffOrg]);
  await clearPilot();
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await identity(context, "admin");
});
test.afterAll(async () => {
  if (!staffOrg) return;
  await clearPilot();
  await query('DELETE FROM "AuditEvent" WHERE "tenantId" = $1::uuid', [staffOrg]);
  await query('DELETE FROM "Membership" WHERE "organizationId" = $1::uuid', [staffOrg]);
  await query('DELETE FROM "Organization" WHERE id = $1::uuid', [staffOrg]);
});

test("MYF-P09-AC001 staff open a cohort, a farmer joins and is counted once, and leaving removes them", async ({ page, context }) => {
  test.setTimeout(120_000);
  // Staff open a cohort from the administrator workspace.
  await page.goto("/admin?scope=" + staffOrg);
  await page.getByRole("link", { name: "Pilot cohorts" }).click();
  await expect(page.getByRole("heading", { name: "Pilot cohorts" })).toBeVisible();
  await page.getByLabel("Cohort name").fill("Rukungiri season A");
  await page.getByLabel("First day").fill(day(-3));
  await page.getByLabel("Last day").fill(day(100));
  await page.getByRole("button", { name: "Open cohort" }).click();
  await expect(page.getByText("Cohort opened.")).toBeVisible();
  const code = (await page.locator("p", { hasText: /^Code / }).locator("strong").textContent())!.trim();
  expect(code).toMatch(/^[A-Z0-9]{8}$/);
  const cohortUrl = page.url();
  await noSideScroll(page);

  // A farmer joins with the code as read out, after ticking the box.
  await identity(context, "a");
  await page.goto("/farms");
  await page.getByRole("link", { name: "Pilot" }).click();
  await expect(page.getByRole("heading", { name: "Join the MyFarm pilot" })).toBeVisible();
  await page.getByLabel("Pilot code").fill(code.slice(0, 4).toLowerCase() + "-" + code.slice(4));
  await page.getByRole("button", { name: "Join the pilot" }).click();
  await expect(page.getByText("Tick the box to agree, or leave this page.")).toBeVisible();
  await page.getByLabel("I have read this and I agree to join the pilot.").check();
  await page.getByRole("button", { name: "Join the pilot" }).click();
  await expect(page.getByRole("heading", { name: "You are in the pilot" })).toBeVisible();
  await expect(page.getByText("P-01", { exact: true })).toBeVisible();
  await noSideScroll(page);
  // Other specs may already have saved records for this farmer today, so the count is read before and after.
  const expenses = async () => {
    const response = await context.request.get(`/api/v1/scopes/${staffOrg}/pilot/cohorts/${cohortUrl.split("/admin/pilot/")[1].split("?")[0]}`);
    expect(response.status()).toBe(200);
    return (await response.json() as { cohort: { measures: { expensesRecorded: number } } }).cohort.measures.expensesRecorded;
  };
  await identity(context, "admin");
  const before = await expenses();
  await identity(context, "a");
  // An expense saved twice with one request counts once.
  const expense = { requestId: id(), categoryId: feed, amount: "4321", currency: "UGX", occurredOn: day(0) };
  for (let i = 0; i < 2; i++) expect((await context.request.post(`/api/v1/farms/${fixtures.farms.a}/accounting/expenses`, { headers: origin, data: expense })).status()).toBe(201);
  // A farmer cannot see staff views.
  expect((await context.request.get(`/api/v1/scopes/${staffOrg}/pilot/cohorts`)).status()).toBe(403);

  // Staff see the count and the code name, never the farm, the amount or who the farmer is.
  await identity(context, "admin");
  await page.goto(cohortUrl);
  const measures = page.getByRole("region", { name: "The ten measures" });
  await expect(measures.locator("dt", { hasText: "Expenses recorded" }).locator("+ dd")).toHaveText(String(before + 1));
  await expect(measures.locator("dt", { hasText: "Farmers onboarded" }).locator("+ dd")).toHaveText("1");
  const text = await page.locator("main").innerText();
  for (const secret of ["Browser farm", "4,321", "4321", fixtures.users.a, fixtures.farms.a]) expect(text).not.toContain(secret);

  // Staff log a reminder, an incident and its resolution, and the paper consent.
  await page.getByLabel("Farmer", { exact: true }).first().selectOption({ label: "P-01" });
  await page.getByRole("button", { name: "Log reminder" }).click();
  await expect(page.getByText("Reminder logged.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Farmers by code name" })).toContainText("Used after reminder");
  const incident = page.getByRole("form", { name: "Log a support incident" });
  await incident.getByLabel("What happened").fill("Entries waited a day to send");
  await incident.getByRole("button", { name: "Log incident" }).click();
  await expect(page.getByText("Incident logged.")).toBeVisible();
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByText("Incident marked resolved.")).toBeVisible();
  await page.getByLabel("Paper form reference").fill("FORM-07");
  await page.getByRole("button", { name: "Record" }).click();
  await expect(page.getByText("Every farmer in the pilot has a paper consent recorded.")).toBeVisible();
  await noSideScroll(page);

  // Another farmer cannot open staff pages; staff of nothing cannot either.
  await identity(context, "b");
  await page.goto(cohortUrl);
  await expect(page).toHaveURL(/\/forbidden/);

  // The farmer leaves: from then on they count nowhere.
  await identity(context, "a");
  await page.goto("/pilot");
  await page.getByRole("button", { name: "Leave the pilot" }).click();
  await expect(page.getByText("Tick the box if you want to leave.")).toBeVisible();
  await page.getByLabel("Yes, I want to leave the pilot.").check();
  await page.getByRole("button", { name: "Leave the pilot" }).click();
  await expect(page.getByText("You left the pilot. Nothing more is counted about you.")).toBeVisible();
  await identity(context, "admin");
  await page.goto(cohortUrl);
  await expect(page.getByRole("region", { name: "The ten measures" }).locator("dt", { hasText: "Expenses recorded" }).locator("+ dd")).toHaveText("0");
  await expect(page.getByText("No farmer has joined yet. Give farmers the code " + code + ".")).toBeVisible();
});

test("a wrong code is refused plainly and joins nothing", async ({ page, context }) => {
  await identity(context, "a");
  await page.goto("/pilot");
  await page.getByLabel("Pilot code").fill("ZZZZ-ZZZZ");
  await page.getByLabel("I have read this and I agree to join the pilot.").check();
  await page.getByRole("button", { name: "Join the pilot" }).click();
  await expect(page.getByText("That code was not accepted. Check it with the MyFarm team, and tick the box to agree.")).toBeVisible();
  expect((await query('SELECT count(*)::int AS n FROM "PilotParticipation" WHERE "userId" = $1', [fixtures.users.a])).rows[0].n).toBe(0);
});
