import { expect, test, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
const origin = { origin: "http://127.0.0.1:3102" };
let fixtures: ProductionBrowserFixtures;
const created = z.object({ batch: z.object({ batchId: z.uuid(), farmId: z.uuid(), tenantId: z.uuid(), animalTypeName: z.string(), batchLabel: z.string(), breed: z.string().nullable(), startingQuantity: z.number().int(), currentQuantity: z.number().int(), currentQuantitySource: z.literal("STARTING_COUNT"), status: z.literal("ACTIVE"), version: z.literal(1) }) });
async function query(sql: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  await query('DELETE FROM "PoultryBatch" WHERE "tenantId" = ANY($1::uuid[])', [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after = NULL WHERE id = ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status = \'ACTIVE\' WHERE "userId" = $1', [fixtures.users.a]);
  await identity(context, "a");
});
async function input(context: BrowserContext) {
  const enterprise = await context.request.post(`/api/v1/farms/${fixtures.farms.a}/enterprises`, { headers: origin, data: { requestId: id(), name: "API layers " + id(), type: "POULTRY" } });
  expect(enterprise.status()).toBe(201);
  const enterpriseId = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await enterprise.json()).enterprise.enterpriseId;
  return { requestId: id(), enterpriseId, animalTypeId: "f4030008-0000-4000-8000-000000000004", batchLabel: "Batch " + id().slice(0, 8), startingQuantity: 100, acquisitionDate: "2026-03-01", purpose: "EGGS" };
}
test("authenticated poultry API creates, lists, reads and replays a committed normalized command", async ({ context }) => {
  const data = await input(context), path = `/api/v1/farms/${fixtures.farms.a}/poultry-batches`;
  const catalog = await context.request.get(`/api/v1/farms/${fixtures.farms.a}/animal-types`);
  expect(catalog.status()).toBe(200); expect(catalog.headers()["cache-control"]).toContain("no-store");
  expect(z.object({ items: z.array(z.object({ name: z.string() })) }).parse(await catalog.json()).items.map(t => t.name)).toEqual(["Chicken", "Duck", "Turkey", "Guinea fowl"]);
  const response = await context.request.post(path, { headers: origin, data: { ...data, startingQuantity: "0100", batchLabel: "  " + data.batchLabel + "  " } });
  expect(response.status()).toBe(201); expect(response.headers()["cache-control"]).toContain("no-store");
  const row = created.parse(await response.json()).batch;
  expect(row).toMatchObject({ farmId: fixtures.farms.a, tenantId: fixtures.tenants.a, animalTypeName: "Chicken", batchLabel: data.batchLabel, breed: null, startingQuantity: 100, currentQuantity: 100 });
  const replay = await context.request.post(path, { headers: origin, data }); expect(replay.status()).toBe(201); expect(created.parse(await replay.json()).batch).toEqual(row);
  const detail = await context.request.get(path + "/" + row.batchId); expect(detail.status()).toBe(200); expect(created.parse(await detail.json()).batch).toEqual(row);
  const list = await context.request.get(path); expect(list.status()).toBe(200);
  expect(z.object({ items: z.array(z.object({ batchId: z.uuid() })) }).parse(await list.json()).items.map(b => b.batchId)).toEqual([row.batchId]);
  const counts = await query('SELECT (SELECT count(*)::int FROM "PoultryBatch" WHERE "enterpriseId"=$1) AS effects, (SELECT count(*)::int FROM "AuditEvent" WHERE "requestId"=$2) AS audits', [data.enterpriseId, data.requestId]);
  expect(counts.rows[0]).toEqual({ effects: 1, audits: 1 });
});
test("poultry API rejects fractional birds, duplicate labels, IDOR, forged scope, CSRF and changed replays", async ({ context }) => {
  const data = await input(context), farm = fixtures.farms.a, path = `/api/v1/farms/${farm}/poultry-batches`;
  for (const startingQuantity of [1.5, -1, "2.0"]) {
    const bad = await context.request.post(path, { headers: origin, data: { ...data, requestId: id(), startingQuantity } }); expect(bad.status()).toBe(400);
  }
  const row = created.parse(await (await context.request.post(path, { headers: origin, data })).json()).batch;
  const duplicate = await context.request.post(path, { headers: origin, data: { ...data, requestId: id(), batchLabel: data.batchLabel.toUpperCase() } }); expect(duplicate.status()).toBe(409);
  const conflict = await context.request.post(path, { headers: origin, data: { ...data, startingQuantity: 99 } }); expect(conflict.status()).toBe(409);
  const forged = await context.request.post(path, { headers: origin, data: { ...data, requestId: id(), tenantId: fixtures.tenants.b } }); expect(forged.status()).toBe(400);
  const csrf = await context.request.post(path, { headers: { origin: "https://untrusted.test" }, data }); expect(csrf.status()).toBe(403);
  const nested = await context.request.get(`/api/v1/farms/${fixtures.farms.a2}/poultry-batches/${row.batchId}`); expect(nested.status()).toBe(403);
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const url of [path, path + "/" + row.batchId, `/api/v1/farms/${farm}/animal-types`]) { const denied = await context.request.get(url); expect(denied.status()).toBe(403); expect(await denied.json()).toEqual({ error: "FORBIDDEN", requestId: expect.any(String) }); }
    expect((await context.request.post(path, { headers: origin, data })).status()).toBe(403);
  }
  expect((await query('SELECT count(*)::int AS n FROM "PoultryBatch" WHERE "enterpriseId"=$1', [data.enterpriseId])).rows[0].n).toBe(1);
});
test("poultry API checks a revoked server session", async ({ context }) => {
  const data = await input(context), path = `/api/v1/farms/${fixtures.farms.a}/poultry-batches`;
  await query('UPDATE auth.sessions SET not_after = now() - interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  const denied = await context.request.post(path, { headers: origin, data }); expect(denied.status()).toBe(401);
  expect(await denied.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId"=$1', [data.requestId])).rows[0].n).toBe(0);
});
