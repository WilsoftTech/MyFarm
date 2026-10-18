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
const chicken = "f4030008-0000-4000-8000-000000000004", duck = "f4030008-0000-4000-8000-000000000003";
let tenantA: string, tenantB: string, farmA: string, farmA2: string, farmB: string;
const catalogFixture = id();
const scope = () => ({ actorId: users.a, tenantId: tenantA, farmId: farmA });
async function command(farm = farmA, who: "a" | "b" = "a", type: "POULTRY" | "CROP" = "POULTRY") {
  const enterprise = await production(who).createEnterprise(farm, { requestId: id(), name: "Birds " + id(), type });
  return { requestId: id(), enterpriseId: enterprise.enterpriseId, animalTypeId: chicken, batchLabel: "Batch " + id(), startingQuantity: 100, acquisitionDate: "2026-03-01", purpose: "EGGS" as const };
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
  await owner.animalTypeCatalog.create({ data: { id: catalogFixture, name: "Synthetic bird " + catalogFixture } });
}, 30_000);
afterAll(async () => {
  const tenants = [tenantA, tenantB].filter(Boolean), actors = Object.values(users);
  try {
    await owner.poultryBatch.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.animalTypeCatalog.deleteMany({ where: { id: catalogFixture } });
    await owner.enterprise.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } });
    await owner.farmMember.deleteMany({ where: { userId: { in: actors } } }); await owner.farm.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } }); await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
    await owner.membership.deleteMany({ where: { userId: { in: actors } } }); await owner.organization.deleteMany({ where: { id: { in: tenants } } }); await owner.user.deleteMany({ where: { id: { in: actors } } });
  } finally { await Promise.all([owner.$disconnect(), runtime.$disconnect()]); }
});

describe("poultry persistence with real restricted runtime role", () => {
  it("stores exact values, optional breed, trusted metadata, count provenance and atomic audit", async () => {
    const input = { ...await command(), breed: " ", batchLabel: "  Layers   #004 ", startingQuantity: "0250" };
    const row = await service().start(farmA, input);
    expect(await runtime.$queryRaw`SELECT current_user AS role`).toEqual([{ role: "myfarm_runtime" }]);
    expect(row).toMatchObject({ farmId: farmA, tenantId: tenantA, animalTypeName: "Chicken", breed: null, batchLabel: "Layers #004", startingQuantity: 250, currentQuantity: 250, currentQuantitySource: "STARTING_COUNT", acquisitionDate: "2026-03-01", purpose: "EGGS", status: "ACTIVE", version: 1, createdBy: users.a });
    expect(await service().batch(farmA, row.batchId)).toEqual(row);
    expect((await owner.poultryBatch.findUniqueOrThrow({ where: { id: row.batchId } })).batchLabelKey).toBe("layers #004");
    expect(await owner.auditEvent.findMany({ where: { requestId: input.requestId } })).toEqual([expect.objectContaining({ action: "POULTRY_BATCH_STARTED", targetId: row.batchId, actorId: users.a, tenantId: tenantA })]);
  });
  it("reads the approved animal-type catalog, Chicken first, and hides inactive entries", async () => {
    await owner.animalTypeCatalog.update({ where: { id: catalogFixture }, data: { active: false } });
    try {
      expect((await service().animalTypes(farmA)).items.map(t => t.name)).toEqual(["Chicken", "Duck", "Turkey", "Guinea fowl"]);
    } finally { await owner.animalTypeCatalog.update({ where: { id: catalogFixture }, data: { active: true } }); }
    expect((await service().animalTypes(farmA)).items.map(t => t.animalTypeId)).toContain(catalogFixture);
    const first = await service().animalTypes(farmA, { limit: 1 }); expect(first.items).toHaveLength(1);
    expect((await service().animalTypes(farmA, { limit: 1, cursor: first.nextCursor })).items[0].animalTypeId).not.toBe(first.items[0].animalTypeId);
    await expect(service().animalTypes(farmA, { cursor: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("stores 0 and the maximum whole count and rejects fractional/negative birds without receipts", async () => {
    const input = await command();
    expect(await service().start(farmA, { ...input, startingQuantity: 0 })).toMatchObject({ startingQuantity: 0, currentQuantity: 0 });
    expect(await service().start(farmA, { ...input, requestId: id(), batchLabel: "Max " + id(), startingQuantity: 2147483647 })).toMatchObject({ startingQuantity: 2147483647 });
    for (const change of [{ startingQuantity: -1 }, { startingQuantity: "1.5" }, { startingQuantity: 2147483648 }, { acquisitionDate: "2026-02-29" }, { purpose: "OTHER" }]) {
      const bad = { ...input, requestId: id(), batchLabel: "Bad " + id(), ...change };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
  });
  it("keeps batch labels unique per farm across enterprises and statuses, ignoring case and spacing", async () => {
    const input = await command(), label = "Batch #" + id().slice(0, 8), row = await service().start(farmA, { ...input, batchLabel: label });
    const other = await command();
    for (const variant of [label.toUpperCase(), "  " + label.replace(" ", "   ") + " "]) {
      const bad = { ...other, requestId: id(), batchLabel: variant };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
    await owner.poultryBatch.update({ where: { id: row.batchId }, data: { status: "CLOSED" } });
    await expect(service().start(farmA, { ...other, requestId: id(), batchLabel: label })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await service().start(farmA2, { ...await command(farmA2), batchLabel: label })).toMatchObject({ batchLabel: label, farmId: farmA2 });
    expect(await service("b").start(farmB, { ...await command(farmB, "b"), batchLabel: label })).toMatchObject({ batchLabel: label, farmId: farmB });
    expect(await service().start(farmA, { ...other, requestId: id(), batchLabel: label + "1" })).toMatchObject({ status: "ACTIVE" });
  });
  it("separates same-tenant farms, cross-user tenants, nested IDs and pagination cursors", async () => {
    const input = await command(), row = await service().start(farmA, input);
    const other = await service().start(farmA2, await command(farmA2));
    await expect(service().batch(farmA2, row.batchId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service().list(farmA2, { cursor: row.batchId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service().batch(farmA, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const who of ["b", "admin"] as const) {
      for (const action of [() => service(who).start(farmA, input), () => service(who).batch(farmA, row.batchId), () => service(who).list(farmA), () => service(who).animalTypes(farmA)]) await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect((await service().list(farmA2)).items.map(b => b.batchId)).toContain(other.batchId);
    expect((await service().list(farmA2)).items.every(b => b.farmId === farmA2)).toBe(true);
    for (const enterpriseId of [(await command(farmB, "b")).enterpriseId, (await command(farmA2)).enterpriseId]) {
      const bad = { ...input, requestId: id(), batchLabel: "Foreign " + id(), enterpriseId };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
  });
  it("paginates tied creation times without omissions or duplicates", async () => {
    const input = await command(farmA2);
    for (let n = 0; n < 4; n++) await service().start(farmA2, { ...input, requestId: id(), batchLabel: "Page " + id() });
    await owner.poultryBatch.updateMany({ where: { farmId: farmA2 }, data: { createdAt: new Date("2026-10-19T00:00:00Z") } });
    const seen: string[] = []; let cursor: string | undefined;
    do { const page = await service().list(farmA2, { limit: 2, cursor }); seen.push(...page.items.map(b => b.batchId)); cursor = page.nextCursor ?? undefined; } while (cursor);
    expect(new Set(seen).size).toBe(seen.length); expect(seen.length).toBe(await owner.poultryBatch.count({ where: { farmId: farmA2 } }));
  });
  it("rejects wrong-type/closed enterprises and missing/inactive catalog entries", async () => {
    const input = await command();
    await expect(service().start(farmA, { ...input, enterpriseId: (await command(farmA, "a", "CROP")).enterpriseId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service().start(farmA, { ...input, animalTypeId: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await owner.animalTypeCatalog.update({ where: { id: catalogFixture }, data: { active: false } });
    try { await expect(service().start(farmA, { ...input, animalTypeId: catalogFixture })).rejects.toMatchObject({ code: "CONFLICT" }); }
    finally { await owner.animalTypeCatalog.update({ where: { id: catalogFixture }, data: { active: true } }); }
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { status: "CLOSED" } });
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
  });
});

describe("atomicity, idempotency and concurrency", () => {
  it("concurrent duplicates create and audit exactly once", async () => {
    const input = await command();
    const rows = await Promise.all(Array.from({ length: 6 }, () => service().start(farmA, input)));
    expect(new Set(rows.map(r => r.batchId)).size).toBe(1);
    expect(await owner.poultryBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(1);
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
    expect(await service().start(farmA, { ...input, startingQuantity: "0100", batchLabel: " " + input.batchLabel + " " })).toEqual(rows[0]);
  });
  it("lets exactly one of several competing requests claim a batch label", async () => {
    const input = await command(), label = "Race " + id().slice(0, 8);
    const results = await Promise.allSettled(Array.from({ length: 4 }, (_, n) => service().start(farmA, { ...input, requestId: id(), batchLabel: n % 2 ? label.toUpperCase() : label })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toEqual(Array.from({ length: 3 }, () => expect.objectContaining({ reason: expect.objectContaining({ code: "CONFLICT" }) })));
    const rows = await owner.poultryBatch.findMany({ where: { enterpriseId: input.enterpriseId } }); expect(rows).toHaveLength(1);
    expect(await owner.auditEvent.count({ where: { action: "POULTRY_BATCH_STARTED", targetId: rows[0].id } })).toBe(1);
  });
  it("conflicts on each changed creation field or farm, without another receipt/effect", async () => {
    const input = await command(); await service().start(farmA, input);
    for (const change of [{ animalTypeId: duck }, { enterpriseId: id() }, { breed: "Kuroiler" }, { batchLabel: input.batchLabel.toUpperCase() }, { startingQuantity: 101 }, { acquisitionDate: "2026-03-02" }, { purpose: "MEAT" as const }]) await expect(service().start(farmA, { ...input, ...change })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service().start(farmA2, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
  });
  it("replays committed creation after catalog/parent lifecycle changes without rewriting its snapshot", async () => {
    const input = { ...await command(), animalTypeId: catalogFixture }, row = await service().start(farmA, input);
    await owner.animalTypeCatalog.update({ where: { id: catalogFixture }, data: { active: false, name: "Renamed " + catalogFixture } });
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { status: "CLOSED" } });
    try { expect(await service().start(farmA, input)).toEqual(row); }
    finally { await owner.animalTypeCatalog.update({ where: { id: catalogFixture }, data: { active: true, name: "Synthetic bird " + catalogFixture } }); }
  });
  it("rolls the audit receipt back on database failure and accepts a corrected retry", async () => {
    const input = { ...startPoultryBatchSchema.parse(await command()), breed: "x".repeat(121) };
    await expect(poultryBatchRepository(runtime).startPoultryBatch(scope(), input)).rejects.toThrow();
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
    expect(await owner.poultryBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(0);
    await expect(service().start(farmA, { ...input, breed: "Corrected" })).resolves.toMatchObject({ breed: "Corrected" });
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
        await expect(poultryBatchRepository(runtime).startPoultryBatch(scope(), startPoultryBatchSchema.parse({ ...input, requestId: id(), batchLabel: "Revoked " + id() }))).rejects.toMatchObject({ code: "FORBIDDEN" });
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
      expect(await owner.poultryBatch.count({ where: { enterpriseId: input.enterpriseId } })).toBe(0);
    } finally {
      await blocker.query("ROLLBACK"); await blocker.end(); if (attempt) await attempt;
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "ACTIVE" } });
    }
  });
});

describe("database constraints and least privilege", () => {
  it("rejects cross-farm/tenant enterprises and duplicate label keys at the database boundary", async () => {
    const row = await service().start(farmA, await command()), original = await owner.poultryBatch.findUniqueOrThrow({ where: { id: row.batchId } });
    const fresh = () => ({ ...original, id: id(), batchLabelKey: "key " + id() });
    await expect(owner.poultryBatch.create({ data: { ...fresh(), enterpriseId: (await command(farmA2)).enterpriseId } })).rejects.toMatchObject({ code: "P2003" });
    await expect(owner.poultryBatch.create({ data: { ...fresh(), tenantId: tenantB } })).rejects.toMatchObject({ code: "P2003" });
    await expect(owner.poultryBatch.create({ data: { ...original, id: id() } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("enforces whole nonnegative counts, dates, nonblank strings and versions", async () => {
    const row = await service().start(farmA, await command());
    for (const expression of ['"startingQuantity" = -1', 'version = 0', 'breed = \'   \'', '"batchLabel" = \'  \'', '"batchLabelKey" = \'\'', '"animalTypeName" = \'\'', '"acquisitionDate" = \'infinity\'', 'purpose = \'OTHER\'']) await expect(owner.$executeRawUnsafe('UPDATE "PoultryBatch" SET ' + expression + ' WHERE id = $1::uuid', row.batchId)).rejects.toThrow();
    await expect(owner.$executeRawUnsafe('UPDATE "PoultryBatch" SET "startingQuantity" = 1.5 WHERE id = $1::uuid', row.batchId)).resolves.toBe(1);
    expect((await owner.poultryBatch.findUniqueOrThrow({ where: { id: row.batchId } })).startingQuantity).toBe(2);
  });
  it("permits no forged runtime inserts, updates/deletes, catalog writes or browser-role access", async () => {
    const row = await service().start(farmA, await command()), data = await owner.poultryBatch.findUniqueOrThrow({ where: { id: row.batchId } });
    const denied = /permission denied|row-level security/i, crop = (await command(farmA, "a", "CROP")).enterpriseId;
    for (const change of [{ createdBy: users.b }, { createdBy: users.admin }, { status: "CLOSED" as const }, { version: 2 }, { enterpriseId: crop }, { animalTypeName: "Forged name" }]) await expect(runtime.poultryBatch.create({ data: { ...data, id: id(), batchLabelKey: "forged " + id(), ...change } })).rejects.toThrow(denied);
    await expect(runtime.poultryBatch.updateMany({ where: { id: row.batchId }, data: { status: "CLOSED" } })).rejects.toThrow(denied);
    await expect(runtime.poultryBatch.deleteMany({ where: { id: row.batchId } })).rejects.toThrow(denied);
    await expect(runtime.animalTypeCatalog.create({ data: { id: id(), name: "Forbidden" } })).rejects.toThrow(denied);
    await expect(runtime.animalTypeCatalog.updateMany({ data: { active: false } })).rejects.toThrow(denied);
    await expect(runtime.animalTypeCatalog.deleteMany({ where: { id: catalogFixture } })).rejects.toThrow(denied);
    for (const role of ["anon", "authenticated"]) for (const table of ["PoultryBatch", "AnimalTypeCatalog"]) await expect(owner.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE " + role); await tx.$queryRawUnsafe('SELECT * FROM "' + table + '"');
    })).rejects.toThrow(denied);
  });
});
