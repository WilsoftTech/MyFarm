import { expect, test, type BrowserContext } from "@playwright/test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const id = () => crypto.randomUUID();
let fixtures: ProductionBrowserFixtures;
const created = z.object({ cycle: z.object({ cycleId: z.uuid(), farmId: z.uuid(), tenantId: z.uuid(), cropName: z.string(), areaPlanted: z.string(), variety: z.string().nullable(), expectedHarvest: z.string().nullable(), status: z.literal("ACTIVE"), version: z.literal(1) }) });
async function query(sql: string, values: unknown[]) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function identity(context: BrowserContext, who: "a" | "b" | "admin") {
  await context.clearCookies(); await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
test.beforeEach(async ({ context }) => {
  fixtures = readProductionBrowserFixtures();
  await query('DELETE FROM "CropCycle" WHERE "tenantId" = ANY($1::uuid[])', [Object.values(fixtures.tenants)]);
  await query('UPDATE auth.sessions SET not_after = NULL WHERE id = ANY($1::uuid[])', [Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status = \'ACTIVE\' WHERE "userId" = $1', [fixtures.users.a]);
  await identity(context, "a");
});
async function input(context: BrowserContext) {
  const request = context.request, farm = fixtures.farms.a, headers = { origin: "http://127.0.0.1:3102" };
  const enterprise = await request.post(`/api/v1/farms/${farm}/enterprises`, { headers, data: { requestId: id(), name: "API fixture " + id(), type: "CROP" } });
  expect(enterprise.status()).toBe(201);
  const enterpriseId = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await enterprise.json()).enterprise.enterpriseId;
  const season = await request.post(`/api/v1/farms/${farm}/seasons`, { headers, data: { requestId: id(), label: "API fixture " + id(), startDate: "2026-03-01" } });
  expect(season.status()).toBe(201);
  const seasonId = z.object({ season: z.object({ seasonId: z.uuid() }) }).parse(await season.json()).season.seasonId;
  const plotId = id();
  await query('INSERT INTO "Plot" (id,"tenantId","farmId",name,area,"areaUnit","createdBy") VALUES ($1,$2,$3,$4,1,\'ACRE\',$5)', [plotId, fixtures.tenants.a, farm, "API plot " + plotId, fixtures.users.a]);
  return { requestId: id(), enterpriseId, seasonId, plotId, cropId: "f4030005-0000-4000-8000-000000000001", areaPlanted: "0.5", areaUnit: "ACRE", plantingDate: "2026-03-01" };
}
test("authenticated crop API creates, lists, reads and replays a committed normalized command", async ({ context }) => {
  const data = await input(context), path = `/api/v1/farms/${fixtures.farms.a}/crop-cycles`, headers = { origin: "http://127.0.0.1:3102" };
  const catalog = await context.request.get(`/api/v1/farms/${fixtures.farms.a}/crops`);
  expect(catalog.status()).toBe(200); expect(catalog.headers()["cache-control"]).toContain("no-store");
  expect(z.object({ items: z.array(z.object({ name: z.string() })) }).parse(await catalog.json()).items.map(c => c.name)).toEqual(expect.arrayContaining(["Maize", "Coffee"]));
  const response = await context.request.post(path, { headers, data: { ...data, areaPlanted: "00.500000" } });
  expect(response.status()).toBe(201); expect(response.headers()["cache-control"]).toContain("no-store");
  const row = created.parse(await response.json()).cycle;
  expect(row).toMatchObject({ farmId: fixtures.farms.a, tenantId: fixtures.tenants.a, cropName: "Maize", areaPlanted: "0.5", variety: null, expectedHarvest: null });
  const replay = await context.request.post(path, { headers, data }); expect(replay.status()).toBe(201); expect(created.parse(await replay.json()).cycle).toEqual(row);
  const detail = await context.request.get(path + "/" + row.cycleId); expect(detail.status()).toBe(200); expect(created.parse(await detail.json()).cycle).toEqual(row);
  const list = await context.request.get(path); expect(list.status()).toBe(200);
  expect(z.object({ items: z.array(z.object({ cycleId: z.uuid() })) }).parse(await list.json()).items.map(c => c.cycleId)).toEqual([row.cycleId]);
  const counts = await query('SELECT (SELECT count(*)::int FROM "CropCycle" WHERE "plotId"=$1) AS effects, (SELECT count(*)::int FROM "AuditEvent" WHERE "requestId"=$2) AS audits', [data.plotId, data.requestId]);
  expect(counts.rows[0]).toEqual({ effects: 1, audits: 1 });
});

test("released catalog data can be selected and planted through the authorized API", async ({ context }) => {
  const farm = fixtures.farms.a, headers = { origin: "http://127.0.0.1:3102" };
  const catalog = await context.request.get(`/api/v1/farms/${farm}/crops`);
  expect(catalog.status()).toBe(200);
  const crops = z.object({ items: z.array(z.object({ cropId: z.uuid(), name: z.string() })) }).parse(await catalog.json()).items;
  expect(crops).toHaveLength(14);
  const crop = crops.find(row => row.name === "Beans"); expect(crop).toBeDefined();
  const data = { ...await input(context), cropId: crop?.cropId };
  const path = `/api/v1/farms/${farm}/crop-cycles`;
  const response = await context.request.post(path, { headers, data }); expect(response.status()).toBe(201);
  const row = created.parse(await response.json()).cycle; expect(row.cropName).toBe("Beans");
  const replay = await context.request.post(path, { headers, data }); expect(replay.status()).toBe(201);
  expect(created.parse(await replay.json()).cycle).toEqual(row);
  await identity(context, "b");
  expect((await context.request.get(`/api/v1/farms/${farm}/crops`)).status()).toBe(403);
  expect((await context.request.get(path + "/" + row.cycleId)).status()).toBe(403);
});

test("enterprise API derives capabilities on create, detail and list within authorized farm scope", async ({ context }) => {
  const base = `/api/v1/farms/${fixtures.farms.a}/enterprises`, headers = { origin: "http://127.0.0.1:3102" };
  const schema = z.object({ enterprise: z.object({ enterpriseId: z.uuid(), type: z.string(), workflow: z.string().nullable() }) });
  for (const [type, workflow] of [["CROP", "CROP_CYCLE"], ["POULTRY", "POULTRY_BATCH"], ["DAIRY", null], ["LIVESTOCK", null], ["FISH", null], ["OTHER", null]] as const) {
    const response = await context.request.post(base, { headers, data: { requestId: id(), name: "Capability " + id(), type } });
    expect(response.status()).toBe(201);
    const row = schema.parse(await response.json()).enterprise; expect(row).toMatchObject({ type, workflow });
    const detail = await context.request.get(base + "/" + row.enterpriseId); expect(detail.status()).toBe(200);
    expect(schema.parse(await detail.json()).enterprise).toEqual(row);
    const list = await context.request.get(base + "?limit=50"); expect(list.status()).toBe(200);
    expect(z.object({ items: z.array(schema.shape.enterprise) }).parse(await list.json()).items).toContainEqual(row);
    expect((await context.request.get(`/api/v1/farms/${fixtures.farms.a2}/enterprises/${row.enterpriseId}`)).status()).toBe(403);
  }
  const forged = await context.request.post(base, { headers, data: { requestId: id(), name: "Forged", type: "OTHER", workflow: "CROP_CYCLE" } });
  expect(forged.status()).toBe(400);
  await identity(context, "b"); expect((await context.request.get(base)).status()).toBe(403);
});
test("crop API rejects IDOR, forged scope, CSRF and changed replay payloads", async ({ context }) => {
  const data = await input(context), farm = fixtures.farms.a, path = `/api/v1/farms/${farm}/crop-cycles`, headers = { origin: "http://127.0.0.1:3102" };
  const response = await context.request.post(path, { headers, data }); const row = created.parse(await response.json()).cycle;
  const conflict = await context.request.post(path, { headers, data: { ...data, areaPlanted: "0.4" } }); expect(conflict.status()).toBe(409);
  const invalid = await context.request.post(path, { headers, data: { ...data, requestId: id(), tenantId: fixtures.tenants.b } }); expect(invalid.status()).toBe(400);
  const csrf = await context.request.post(path, { headers: { origin: "https://untrusted.test" }, data }); expect(csrf.status()).toBe(403);
  const nested = await context.request.get(`/api/v1/farms/${fixtures.farms.a2}/crop-cycles/${row.cycleId}`); expect(nested.status()).toBe(403);
  for (const who of ["b", "admin"] as const) {
    await identity(context, who);
    for (const url of [path, path + "/" + row.cycleId, `/api/v1/farms/${farm}/crops`]) { const denied = await context.request.get(url); expect(denied.status()).toBe(403); expect(await denied.json()).toEqual({ error: "FORBIDDEN", requestId: expect.any(String) }); }
    expect((await context.request.post(path, { headers, data })).status()).toBe(403);
  }
});
test("crop API preserves atomic failure and checks a revoked server session", async ({ context }) => {
  const data = await input(context), path = `/api/v1/farms/${fixtures.farms.a}/crop-cycles`, headers = { origin: "http://127.0.0.1:3102" };
  const bad = await context.request.post(path, { headers, data: { ...data, areaPlanted: "1.000001" } }); expect(bad.status()).toBe(400);
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId"=$1', [data.requestId])).rows[0].n).toBe(0);
  const retry = await context.request.post(path, { headers, data: { ...data, areaPlanted: "1.000001", areaExceptionReason: "Owner records intercropping" } }); expect(retry.status()).toBe(201);
  await query('UPDATE auth.sessions SET not_after = now() - interval \'1 second\' WHERE id=$1', [fixtures.sessions.a]);
  const denied = await context.request.post(path, { headers, data: { ...data, requestId: id() } }); expect(denied.status()).toBe(401);
  expect(await denied.json()).toEqual({ error: "UNAUTHENTICATED", requestId: expect.any(String) });
});
