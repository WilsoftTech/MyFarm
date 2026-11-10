import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { readZip } from "../support/zip-reader";
const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const rent = "f4040002-0000-4000-8000-000000000105";
let fixtures: ProductionBrowserFixtures;
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
const noSideScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  // Each test starts with a fresh daily allowance; the limit itself is checked below.
  await query(`DELETE FROM "RequestCount" WHERE action = 'FARM_EXPORT'`);
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1', [fixtures.users.a]);
  await query('UPDATE "TransactionCategory" SET active = true WHERE id = $1', [rent]);
  await identity(context, "a");
});

test("D-P09-013 a farmer downloads everything on the farm as one ZIP of spreadsheet files, audited", async ({ page, context }) => {
  const farm = fixtures.farms.a, amount = String(700000 + Math.floor(Math.random() * 99999));
  const saved = await context.request.post(`/api/v1/farms/${farm}/accounting/expenses`, { headers: origin, data: { requestId: id(), currency: "UGX", categoryId: rent, amount, occurredOn: "2027-02-01", counterparty: "=cmd" } });
  expect(saved.status()).toBe(201);
  await page.goto(`/farms/${farm}`);
  await page.getByRole("link", { name: "Download farm data" }).click();
  await expect(page.getByRole("heading", { name: "Download farm data", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Photos" })).toBeVisible();
  await noSideScroll(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download farm data (ZIP)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^myfarm-browser-farm-a-\d{4}-\d\d-\d\d\.zip$/);
  const files = readZip(new Uint8Array(readFileSync((await download.path())!)));
  expect([...files.keys()]).toEqual(expect.arrayContaining(["README.txt", "my-profile.csv", "farm.csv", "money-records.csv", "harvests.csv", "photos.csv"]));
  const money = files.get("money-records.csv")!;
  expect(money.startsWith("﻿recordId,kind,occurredOn,amount,currency,category,")).toBe(true);
  expect(money).toMatch(new RegExp(",EXPENSE,2027-02-01," + amount + "\\.\\d+,UGX,Rent,'=cmd,"));
  expect(files.get("farm.csv")).toContain(farm);
  expect(JSON.stringify([...files.values()])).not.toContain(fixtures.farms.b);
  expect((await query(`SELECT count(*)::int AS n FROM "AuditEvent" WHERE action = 'FARM_EXPORTED' AND "targetId" = $1 AND "actorId" = $2`, [farm, fixtures.users.a])).rows[0].n).toBeGreaterThanOrEqual(1);
});

test("D-P09-014 the export is limited to 3 a day; another farmer and anonymous visitors get nothing", async ({ context, browser }) => {
  const farm = fixtures.farms.a;
  for (let i = 0; i < 3; i++) expect((await context.request.get(`/api/v1/farms/${farm}/export`)).status()).toBe(200);
  const refused = await context.request.get(`/api/v1/farms/${farm}/export`);
  expect(refused.status()).toBe(429);
  expect(refused.headers()["retry-after"]).toBe("86400");
  expect(await refused.json()).toMatchObject({ error: "RATE_LIMITED" });
  await identity(context, "b");
  expect((await context.request.get(`/api/v1/farms/${farm}/export`)).status()).toBe(403);
  const anonymous = await browser.newContext({ baseURL: "http://127.0.0.1:3102" });
  try {
    expect((await anonymous.request.get(`/api/v1/farms/${farm}/export`)).status()).toBe(401);
    const page = await anonymous.newPage(); await page.goto(`/farms/${farm}/export`);
    await expect(page).toHaveURL(/\/sign-in/);
  } finally { await anonymous.close(); }
});
