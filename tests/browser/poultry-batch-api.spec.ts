import { expect, test, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
let fixtures: ProductionBrowserFixtures;
const created = z.object({ batch: z.object({ batchId: z.uuid(), farmId: z.uuid(), tenantId: z.uuid(), batchName: z.string(), breed: z.string().nullable(), startingQuantity: z.number().int(), currentQuantity: z.object({ quantity: z.number().int(), source: z.literal("STARTING_QUANTITY") }), status: z.literal("ACTIVE"), version: z.literal(1) }) });
async function query(sql: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  await query('DELETE FROM "LivestockBatch" WHERE "tenantId" = ANY($1::uuid[])', [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after = NULL WHERE id = ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status = \'ACTIVE\' WHERE "userId" = $1', [fixtures.users.a]);
  await identity(context, "a");
});
async function input(context: BrowserContext, type = "POULTRY") {
  const enterprise = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/enterprises`, { headers: { origin: "http://127.0.0.1:3102" }, data: { requestId: id(), name: "API fixture " + id(), type } });
  expect(enterprise.status()).toBe(201);
  const enterpriseId = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await enterprise.json()).enterprise.enterpriseId;
  return { requestId: id(), enterpriseId, batchName: "Batch " + id(), animalType: "Chicken", startingQuantity: "300", acquisitionDate: "2026-03-01", purpose: "Layers" };
}
test("authenticated poultry API creates, lists, reads and replays a committed normalized command", async ({ context }) => {
  const data = await input(context), path = `/api/v1/farms/${fixtures.farms.a}/poultry-batches`, headers = { origin: "http://127.0.0.1:3102" };
  const response = await context.request.post(path, { headers, data: { ...data, startingQuantity: "000300", breed: " " } });
  expect(response.status()).toBe(201); expect(response.headers()["cache-control"]).toContain("no-store");
  const row = created.parse(await response.json()).batch;
  expect(row).toMatchObject({ farmId: fixtures.farms.a, tenantId: fixtures.tenants.a, startingQuantity: 300, currentQuantity: { quantity: 300, source: "STARTING_QUANTITY" }, breed: null });
  const replay = await context.request.post(path, { headers, data }); expect(replay.status()).toBe(201); expect(created.parse(await replay.json()).batch).toEqual(row);
  const detail = await context.request.get(path + "/" + row.batchId); expect(detail.status()).toBe(200); expect(created.parse(await detail.json()).batch).toEqual(row);
  const list = await context.request.get(path); expect(list.status()).toBe(200);
  expect(z.object({ items: z.array(z.object({ batchId: z.uuid() })) }).parse(await list.json()).items.map(b => b.batchId)).toEqual([row.batchId]);
  const counts = await query('SELECT (SELECT count(*)::int FROM "LivestockBatch" WHERE "enterpriseId"=$1) AS effects, (SELECT count(*)::int FROM "AuditEvent" WHERE "requestId"=$2) AS audits', [data.enterpriseId, data.requestId]);
  expect(counts.rows[0]).toEqual({ effects: 1, audits: 1 });
});
test("poultry API rejects IDOR, forged scope, CSRF, fractional birds, crop parents and changed replays", async ({ context }) => {
  const data = await input(context), farm = fixtures.farms.a, path = `/api/v1/farms/${farm}/poultry-batches`, headers = { origin: "http://127.0.0.1:3102" };
  const row = created.parse(await (await context.request.post(path, { headers, data })).json()).batch;
  expect((await context.request.post(path, { headers, data: { ...data, startingQuantity: "301" } })).status()).toBe(409);
  expect((await context.request.post(path, { headers, data: { ...data, requestId: id(), tenantId: fixtures.tenants.b } })).status()).toBe(400);
  expect((await context.request.post(path, { headers, data: { ...data, requestId: id(), startingQuantity: "1.5" } })).status()).toBe(400);
  expect((await context.request.post(path, { headers, data: { ...await input(context, "CROP"), requestId: id() } })).status()).toBe(400);
  expect((await context.request.post(path, { headers: { origin: "https://untrusted.test" }, data })).status()).toBe(403);
  expect((await context.request.get(`/api/v1/farms/${fixtures.farms.a2}/poultry-batches/${row.batchId}`)).status()).toBe(403);
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const url of [path, path + "/" + row.batchId]) { const denied = await context.request.get(url); expect(denied.status()).toBe(403); expect(await denied.json()).toEqual({ error: "FORBIDDEN", requestId: expect.any(String) }); }
    expect((await context.request.post(path, { headers, data })).status()).toBe(403);
  }
});
test("poultry API checks a revoked server session", async ({ context }) => {
  const data = await input(context), path = `/api/v1/farms/${fixtures.farms.a}/poultry-batches`, headers = { origin: "http://127.0.0.1:3102" };
  await query('UPDATE auth.sessions SET not_after = now() - interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  const denied = await context.request.post(path, { headers, data }); expect(denied.status()).toBe(401);
  expect(await denied.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId"=$1', [data.requestId])).rows[0].n).toBe(0);
});
