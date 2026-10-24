import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ProductionService } from "@/modules/enterprises-seasons/application/production";
import { productionRepository } from "@/modules/enterprises-seasons/infrastructure/repository";
import { PoultryBatchService } from "@/modules/enterprises-seasons/application/poultry-batch";
import { poultryBatchRepository } from "@/modules/enterprises-seasons/infrastructure/poultry-batch-repository";
import { startPoultryBatchSchema } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import { MAX_BIRD_COUNT } from "@/modules/enterprises-seasons/domain/poultry-batch";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Poultry tests require isolated loopback myfarm_phase01_test database.");
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
const id = () => crypto.randomUUID();
const users = { a: id(), b: id(), admin: id() }, subjects = { a: id(), b: id(), admin: id() };
const auth = (who: keyof typeof users) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime));
const registry = (who: keyof typeof users) => new FarmerRegistryService(auth(who), registryRepository(runtime));
const production = (who: keyof typeof users) => new ProductionService(auth(who), registryRepository(runtime), productionRepository(runtime));
const service = (who: keyof typeof users = "a") => new PoultryBatchService(auth(who), registryRepository(runtime), poultryBatchRepository(runtime));
let tenantA: string, tenantB: string, farmA: string, farmA2: string, farmB: string;
const scope = () => ({ actorId: users.a, tenantId: tenantA, farmId: farmA });
async function command(farm = farmA, who: "a" | "b" = "a", type: "POULTRY" | "CROP" = "POULTRY") {
  const enterprise = await production(who).createEnterprise(farm, { requestId: id(), name: "Poultry " + id(), type });
  return { requestId: id(), enterpriseId: enterprise.enterpriseId, batchName: "Batch " + id(), animalType: "Chicken", startingQuantity: "300", acquisitionDate: "2026-03-01", purpose: "Layers" };
}
async function waitForLock(pattern: string) {
  for (let n = 0; n < 100; n++) {
    const rows = await owner.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE ${pattern} AND pid <> pg_backend_pid()) AS waiting`;
    if (rows[0].waiting) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error("Expected database lock wait was not observed");
}
beforeAll(async () => {
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  await owner.user.createMany({ data: (["a", "b", "admin"] as const).map(who => ({ id: users[who], authSubject: subjects[who] })) });
  const profile = (name: string) => ({ requestId: id(), name, phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["POULTRY"] });
  tenantA = (await registry("a").register(profile("Poultry A"))).tenantId; tenantB = (await registry("b").register(profile("Poultry B"))).tenantId;
  const farm = (name: string) => ({ requestId: id(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "POULTRY" });
  farmA = (await registry("a").createFarm(farm("A"))).farmId; farmA2 = (await registry("a").createFarm(farm("A2"))).farmId; farmB = (await registry("b").createFarm(farm("B"))).farmId;
  await owner.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
  await owner.farmMember.create({ data: { userId: users.admin, farmId: farmA, tenantId: tenantA, role: "OWNER" } });
}, 30_000);
afterAll(async () => {
  const tenants = [tenantA, tenantB].filter(Boolean), actors = Object.values(users);
  try {
    await owner.livestockBatch.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.enterprise.deleteMany({ where: { tenantId: { in: tenants } } }); await owner.season.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } }); await owner.plot.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.farmMember.deleteMany({ where: { userId: { in: actors } } }); await owner.farm.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } }); await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
    await owner.membership.deleteMany({ where: { userId: { in: actors } } }); await owner.organization.deleteMany({ where: { id: { in: tenants } } }); await owner.user.deleteMany({ where: { id: { in: actors } } });
  } finally { await Promise.all([owner.$disconnect(), runtime.$disconnect()]); }
});

describe("poultry persistence with real restricted runtime role", () => {
  it("stores normalized fields, trusted metadata, derived quantity provenance and an atomic audit", async () => {
    const input = { ...await command(), batchName: "  Layers 2026 ", startingQuantity: "000300", breed: " " };
    const row = await service().start(farmA, input);
    expect(await runtime.$queryRaw`SELECT current_user AS role`).toEqual([{ role: "myfarm_runtime" }]);
    expect(row).toMatchObject({ farmId: farmA, tenantId: tenantA, batchName: "Layers 2026", breed: null, startingQuantity: 300, currentQuantity: { quantity: 300, source: "STARTING_QUANTITY" }, acquisitionDate: "2026-03-01", status: "ACTIVE", version: 1, createdBy: users.a });
    expect(await service().batch(farmA, row.batchId)).toEqual(row);
    expect(await owner.auditEvent.findMany({ where: { requestId: input.requestId } })).toEqual([expect.objectContaining({ action: "POULTRY_BATCH_STARTED", targetId: row.batchId, actorId: users.a, tenantId: tenantA })]);
    // The stored row has no current-quantity column to overwrite.
    expect(Object.keys(await owner.livestockBatch.findUniqueOrThrow({ where: { id: row.batchId } }))).not.toContain("currentQuantity");
  });
  it("preserves zero and maximum whole counts and rejects fractional/negative birds without receipts", async () => {
    const input = await command();
    expect(await service().start(farmA, { ...input, startingQuantity: "0" })).toMatchObject({ startingQuantity: 0, currentQuantity: { quantity: 0 } });
    expect(await service().start(farmA, { ...input, requestId: id(), startingQuantity: String(MAX_BIRD_COUNT) })).toMatchObject({ startingQuantity: MAX_BIRD_COUNT });
    for (const change of [{ startingQuantity: "1.5" }, { startingQuantity: "-1" }, { startingQuantity: String(MAX_BIRD_COUNT + 1) }, { acquisitionDate: "2026-02-29" }, { batchName: " " }]) {
      const bad = { ...input, requestId: id(), ...change };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
  });
  it("gives distinct requests distinct batches even with identical fields", async () => {
    const input = await command();
    const first = await service().start(farmA, input), second = await service().start(farmA, { ...input, requestId: id() });
    expect(second.batchId).not.toBe(first.batchId);
    expect(await owner.livestockBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(2);
  });
  it("separates same-tenant farms, cross-user tenants, nested IDs and pagination cursors", async () => {
    const input = await command(), row = await service().start(farmA, input);
    const other = await service().start(farmA2, await command(farmA2));
    await expect(service().batch(farmA2, row.batchId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service().list(farmA2, { cursor: row.batchId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service().batch(farmA, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const who of ["b", "admin"] as const) {
      for (const action of [() => service(who).start(farmA, { ...input, requestId: id() }), () => service(who).batch(farmA, row.batchId), () => service(who).list(farmA)]) await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect((await service().list(farmA2)).items.map(b => b.batchId)).toEqual([other.batchId]);
    const foreign = await command(farmB, "b"), sibling = await command(farmA2);
    for (const enterpriseId of [foreign.enterpriseId, sibling.enterpriseId, id()]) {
      const bad = { ...input, requestId: id(), enterpriseId };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
  });
  it("paginates tied creation times without omissions or duplicates", async () => {
    const input = await command(farmA2);
    for (let n = 0; n < 4; n++) await service().start(farmA2, { ...input, requestId: id() });
    await owner.livestockBatch.updateMany({ where: { farmId: farmA2 }, data: { createdAt: new Date("2026-10-24T00:00:00Z") } });
    const seen: string[] = []; let cursor: string | undefined;
    do { const page = await service().list(farmA2, { limit: 2, cursor }); seen.push(...page.items.map(b => b.batchId)); cursor = page.nextCursor ?? undefined; } while (cursor);
    expect(new Set(seen).size).toBe(seen.length); expect(seen.length).toBe(await owner.livestockBatch.count({ where: { farmId: farmA2 } }));
  });
  it("rejects crop/unsupported enterprise types and closed enterprises", async () => {
    const crop = await command(farmA, "a", "CROP");
    await expect(service().start(farmA, crop)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const input = await command();
    for (const type of ["DAIRY", "LIVESTOCK", "FISH", "OTHER"] as const) {
      await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { type } });
      await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { type: "POULTRY", status: "CLOSED" } });
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: { in: [crop.requestId, input.requestId] } } })).toBe(0);
  });
});

describe("atomicity, idempotency and concurrency", () => {
  it("concurrent duplicates create and audit exactly once; a normalized retry replays", async () => {
    const input = await command();
    const rows = await Promise.all(Array.from({ length: 6 }, () => service().start(farmA, input)));
    expect(new Set(rows.map(r => r.batchId)).size).toBe(1);
    expect(await owner.livestockBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(1);
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
    expect(await service().start(farmA, { ...input, startingQuantity: "0300", batchName: " " + input.batchName + " " })).toEqual(rows[0]);
  });
  it("conflicts on each changed creation field or farm, without another receipt/effect", async () => {
    const input = await command(); await service().start(farmA, input);
    for (const change of [{ enterpriseId: id() }, { batchName: "Changed" }, { animalType: "Duck" }, { breed: "Kuroiler" }, { startingQuantity: "301" }, { acquisitionDate: "2026-03-02" }, { purpose: "Broilers" }]) await expect(service().start(farmA, { ...input, ...change })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service().start(farmA2, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
    expect(await owner.livestockBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(1);
  });
  it("replays a committed batch after its enterprise closes", async () => {
    const input = await command(), row = await service().start(farmA, input);
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { status: "CLOSED" } });
    expect(await service().start(farmA, input)).toEqual(row);
  });
  it("rolls the audit receipt back on database failure and accepts a corrected retry", async () => {
    const input = { ...startPoultryBatchSchema.parse(await command()), breed: "x".repeat(121) };
    await expect(poultryBatchRepository(runtime).startPoultryBatch(scope(), input)).rejects.toThrow();
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
    expect(await owner.livestockBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(0);
    await expect(service().start(farmA, { ...input, startingQuantity: String(input.startingQuantity), breed: "Kuroiler" })).resolves.toMatchObject({ breed: "Kuroiler" });
  });
  it("revokes both new writes and replays on farm/tenant membership or account suspension", async () => {
    const input = await command(); await service().start(farmA, input);
    for (const kind of ["farm", "tenant", "account"] as const) {
      const set = async (revoked: boolean) => {
        if (kind === "farm") await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: revoked ? "REVOKED" : "ACTIVE" } });
        if (kind === "tenant") await owner.membership.update({ where: { userId_organizationId: { userId: users.a, organizationId: tenantA } }, data: { status: revoked ? "REVOKED" : "ACTIVE" } });
        if (kind === "account") await owner.user.update({ where: { id: users.a }, data: { status: revoked ? "SUSPENDED" : "ACTIVE" } });
      };
      await set(true);
      try {
        await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(poultryBatchRepository(runtime).startPoultryBatch(scope(), startPoultryBatchSchema.parse({ ...input, requestId: id() }))).rejects.toMatchObject({ code: "FORBIDDEN" });
      } finally { await set(false); }
    }
    const expired = new PoultryBatchService(new AuthorizationService({ currentIdentity: async () => null }, identityRepository(runtime)), registryRepository(runtime), poultryBatchRepository(runtime));
    await expect(expired.start(farmA, input)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("rechecks authorization after waiting on a receipt lock", async () => {
    const input = await command(), blocker = new Client({ connectionString: url }); await blocker.connect(); let attempt: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('INSERT INTO "AuditEvent" (id, "actorId", "tenantId", action, "targetId", "requestId") VALUES ($1,$2,$3,\'POULTRY_BATCH_STARTED\',$4,$5)', [id(), users.a, tenantA, id(), input.requestId]);
      attempt = service().start(farmA, input).then(r => r, (error: unknown) => error);
      await waitForLock("%AuditEvent%");
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "REVOKED" } });
      await blocker.query("ROLLBACK"); expect(await attempt).toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
      expect(await owner.livestockBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(0);
    } finally {
      await blocker.query("ROLLBACK"); await blocker.end(); if (attempt) await attempt;
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "ACTIVE" } });
    }
  });
});

describe("database constraints and least privilege", () => {
  it("rejects cross-farm and cross-tenant enterprise combinations at the database boundary", async () => {
    const foreign = await command(farmA2), row = await service().start(farmA, await command());
    const original = await owner.livestockBatch.findUniqueOrThrow({ where: { id: row.batchId } });
    await expect(owner.livestockBatch.create({ data: { ...original, id: id(), enterpriseId: foreign.enterpriseId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(owner.livestockBatch.create({ data: { ...original, id: id(), tenantId: tenantB } })).rejects.toMatchObject({ code: "P2003" });
  });
  it("enforces nonnegative whole counts, dates, nonblank strings and versions", async () => {
    const row = await service().start(farmA, await command());
    for (const expression of ['"startingQuantity" = -1', '"startingQuantity" = 2147483648', 'version = 0', '"batchName" = \'   \'', '"animalType" = \'\'', 'purpose = \' \'', 'breed = \'   \'', '"acquisitionDate" = \'infinity\'']) await expect(owner.$executeRawUnsafe('UPDATE "LivestockBatch" SET ' + expression + ' WHERE id = $1::uuid', row.batchId)).rejects.toThrow();
  });
  it("permits no runtime updates/deletes, forged inserts or browser-role access", async () => {
    const row = await service().start(farmA, await command()), data = await owner.livestockBatch.findUniqueOrThrow({ where: { id: row.batchId } });
    const crop = await command(farmA, "a", "CROP");
    const denied = /permission denied|row-level security/i;
    for (const change of [{ createdBy: users.b }, { createdBy: users.admin }, { status: "CLOSED" as const }, { version: 2 }, { enterpriseId: crop.enterpriseId }]) await expect(runtime.livestockBatch.create({ data: { ...data, id: id(), ...change } })).rejects.toThrow(denied);
    await expect(runtime.livestockBatch.updateMany({ where: { id: row.batchId }, data: { startingQuantity: 1 } })).rejects.toThrow(denied);
    await expect(runtime.livestockBatch.deleteMany({ where: { id: row.batchId } })).rejects.toThrow(denied);
    for (const role of ["anon", "authenticated"]) await expect(owner.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE " + role); await tx.$queryRawUnsafe('SELECT * FROM "LivestockBatch"');
    })).rejects.toThrow(denied);
  });
});
