import { expect, test, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
const cropSales = "f4040002-0000-4000-8000-000000000204", fertilizer = "f4040002-0000-4000-8000-000000000111", mobileMoney = "f4040002-0000-4000-8000-000000000302";
let fixtures: ProductionBrowserFixtures;
const balance = z.object({ obligationId: z.uuid(), amount: z.string(), currency: z.string(), settled: z.string(), outstanding: z.string(), settlement: z.string() });
const recordBody = z.object({ record: z.object({ recordId: z.uuid(), farmId: z.uuid(), tenantId: z.uuid(), kind: z.string(), categoryName: z.string(), amount: z.string(), currency: z.string(), status: z.literal("POSTED"), version: z.literal(1), balance: balance.nullable() }) });
const paymentBody = z.object({ payment: z.object({ paymentId: z.uuid(), amount: z.string(), status: z.string(), allocations: z.array(z.object({ obligationId: z.uuid(), amount: z.string() })) }) });
async function query(sql: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  for (const table of ["AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord"]) await query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after = NULL WHERE id = ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status = \'ACTIVE\' WHERE "userId" = $1', [fixtures.users.a]);
  await identity(context, "a");
});
const base = () => `/api/v1/farms/${fixtures.farms.a}/accounting`;
const sale = () => ({ requestId: id(), categoryId: cropSales, amount: "200000", currency: "UGX", occurredOn: "2027-06-01", counterparty: "Market buyer" });

test("authenticated accounting API records a sale, a partial payment and replays exactly once (AC001 via HTTP)", async ({ context }) => {
  const categories = await context.request.get(base() + "/categories?kind=REVENUE");
  expect(categories.status()).toBe(200); expect(categories.headers()["cache-control"]).toContain("no-store");
  expect(z.object({ items: z.array(z.object({ name: z.string() })) }).parse(await categories.json()).items.map(c => c.name)).toEqual(["Crop sales", "Livestock sales", "Egg sales", "Other income"]);
  const methods = await context.request.get(base() + "/payment-methods");
  expect(z.object({ items: z.array(z.object({ name: z.string() })) }).parse(await methods.json()).items.map(m => m.name)).toEqual(["Cash", "Mobile Money", "Bank transfer"]);
  const data = sale(), created = await context.request.post(base() + "/sales", { headers: origin, data: { ...data, amount: "0200000.00" } });
  expect(created.status()).toBe(201); expect(created.headers()["cache-control"]).toContain("no-store");
  const row = recordBody.parse(await created.json()).record;
  expect(row).toMatchObject({ farmId: fixtures.farms.a, tenantId: fixtures.tenants.a, kind: "SALE", categoryName: "Crop sales", amount: "200000", balance: { outstanding: "200000", settlement: "OPEN" } });
  const replay = await context.request.post(base() + "/sales", { headers: origin, data }); expect(replay.status()).toBe(201); expect(recordBody.parse(await replay.json()).record).toEqual(row);
  const pay = { requestId: id(), direction: "RECEIVED", amount: "80000", currency: "UGX", paidOn: "2027-06-05", paymentMethodId: mobileMoney, allocations: [{ obligationId: row.recordId, amount: "80000" }] };
  const paid = await context.request.post(base() + "/payments", { headers: origin, data: pay }); expect(paid.status()).toBe(201);
  const payment = paymentBody.parse(await paid.json()).payment;
  const detail = await context.request.get(base() + "/records/" + row.recordId); expect(detail.status()).toBe(200);
  expect(recordBody.parse(await detail.json()).record.balance).toMatchObject({ settled: "80000", outstanding: "120000", settlement: "PARTIALLY_SETTLED" });
  const paymentDetail = await context.request.get(base() + "/payments/" + payment.paymentId); expect(paymentDetail.status()).toBe(200);
  const list = await context.request.get(base() + "/records"); expect(list.status()).toBe(200);
  expect(z.object({ items: z.array(z.object({ recordId: z.uuid() })) }).parse(await list.json()).items.map(r => r.recordId)).toEqual([row.recordId]);
  const counts = await query('SELECT (SELECT count(*)::int FROM "AccountingRecord" WHERE "tenantId"=$1) AS records, (SELECT count(*)::int FROM "AuditEvent" WHERE "requestId" = ANY($2::uuid[])) AS audits', [fixtures.tenants.a, [data.requestId, pay.requestId]]);
  expect(counts.rows[0]).toEqual({ records: 1, audits: 2 });
});
test("accounting API rejects floats, forged scope, CSRF, IDOR, other users and changed replays", async ({ context }) => {
  const data = sale(), sales = base() + "/sales";
  for (const amount of [0.5, "150,000", "-1", "1e5"]) expect((await context.request.post(sales, { headers: origin, data: { ...data, requestId: id(), amount } })).status()).toBe(400);
  expect((await context.request.post(base() + "/expenses", { headers: origin, data: { ...data, requestId: id(), categoryId: fertilizer, paymentMethodId: mobileMoney, tenantId: fixtures.tenants.b } })).status()).toBe(400);
  const row = recordBody.parse(await (await context.request.post(sales, { headers: origin, data })).json()).record;
  expect((await context.request.post(sales, { headers: origin, data: { ...data, amount: "199999" } })).status()).toBe(409);
  expect((await context.request.post(sales, { headers: { origin: "https://untrusted.test" }, data })).status()).toBe(403);
  expect((await context.request.get(`/api/v1/farms/${fixtures.farms.a2}/accounting/records/${row.recordId}`)).status()).toBe(403);
  const reverse = { requestId: id(), recordType: "SALE", recordId: row.recordId, reason: "Wrong buyer" };
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const url of [base() + "/records", base() + "/records/" + row.recordId, base() + "/categories"]) { const denied = await context.request.get(url); expect(denied.status()).toBe(403); expect(await denied.json()).toEqual({ error: "FORBIDDEN", requestId: expect.any(String) }); }
    expect((await context.request.post(base() + "/reversals", { headers: origin, data: reverse })).status()).toBe(403);
  }
  await identity(context, "a");
  const reversed = await context.request.post(base() + "/reversals", { headers: origin, data: reverse }); expect(reversed.status()).toBe(201);
  expect(z.object({ reversal: z.object({ recordId: z.uuid(), reversal: z.object({ reason: z.literal("Wrong buyer") }) }) }).parse(await reversed.json()).reversal.recordId).toBe(row.recordId);
  expect((await query('SELECT status, amount::text FROM "AccountingRecord" WHERE id=$1', [row.recordId])).rows[0]).toEqual({ status: "REVERSED", amount: "200000.0000" });
});
test("accounting API checks a revoked server session", async ({ context }) => {
  const data = sale();
  await query('UPDATE auth.sessions SET not_after = now() - interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  const denied = await context.request.post(base() + "/sales", { headers: origin, data }); expect(denied.status()).toBe(401);
  expect(await denied.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId"=$1', [data.requestId])).rows[0].n).toBe(0);
});
