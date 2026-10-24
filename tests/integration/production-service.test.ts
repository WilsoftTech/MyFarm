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
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Integration requires isolated local myfarm_phase01_test database.");
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
const id = () => crypto.randomUUID();
const users = { a: id(), b: id(), admin: id() }, subjects = { a: id(), b: id(), admin: id() };
const auth = (who: keyof typeof users) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime));
const registry = (who: keyof typeof users) => new FarmerRegistryService(auth(who), registryRepository(runtime));
const production = (who: keyof typeof users) => new ProductionService(auth(who), registryRepository(runtime), productionRepository(runtime));
const poultry = (who: keyof typeof users) => new PoultryBatchService(auth(who), registryRepository(runtime), poultryBatchRepository(runtime));
const scope = () => ({ tenantId: tenantA, farmId: farmA, actorId: users.a });
const enterpriseInput = (name = "Maize") => ({ requestId: id(), name, type: "CROP" as const });
const seasonInput = (label = "Season A") => ({ requestId: id(), label, startDate: "2026-03-01", endDate: "2026-08-01" });
const denied = /permission denied|row-level security/i;
let tenantA: string, tenantB: string, farmA: string, farmA2: string, farmB: string;
let enterpriseA: string, seasonA: string, plotA: string, plotA2: string;

beforeAll(async () => {
  const provider = new Client({ connectionString: url }); await provider.connect();
  try { await runSqlFile(provider, supabaseEmulation); await applyProviderSql(provider); } finally { await provider.end(); }
  await owner.user.createMany({ data: (["a", "b", "admin"] as const).map(who => ({ id: users[who], authSubject: subjects[who] })) });
  const profile = (name: string) => ({ requestId: id(), name, phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] });
  tenantA = (await registry("a").register(profile("Production A"))).tenantId;
  tenantB = (await registry("b").register(profile("Production B"))).tenantId;
  const farm = (name: string) => ({ requestId: id(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" });
  farmA = (await registry("a").createFarm(farm("A first"))).farmId;
  farmA2 = (await registry("a").createFarm(farm("A second"))).farmId;
  farmB = (await registry("b").createFarm(farm("B first"))).farmId;
  plotA = (await registry("a").createPlot(farmA, { requestId: id(), name: "North" })).plotId;
  plotA2 = (await registry("a").createPlot(farmA2, { requestId: id(), name: "South" })).plotId;
  // Even an explicit farm membership does not turn an ADMIN organization role into FARMER access.
  await owner.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
  await owner.farmMember.create({ data: { userId: users.admin, farmId: farmA, tenantId: tenantA, role: "OWNER" } });
}, 30_000);
afterAll(async () => {
  const actors = Object.values(users), tenants = [tenantA, tenantB].filter(Boolean);
  await owner.enterprise.deleteMany({ where: { tenantId: { in: tenants } } });
  await owner.season.deleteMany({ where: { tenantId: { in: tenants } } });
  await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } });
  await owner.plot.deleteMany({ where: { tenantId: { in: tenants } } });
  await owner.farmMember.deleteMany({ where: { userId: { in: actors } } });
  await owner.farm.deleteMany({ where: { tenantId: { in: tenants } } });
  await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } });
  await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
  await owner.membership.deleteMany({ where: { userId: { in: actors } } });
  await owner.organization.deleteMany({ where: { id: { in: tenants } } });
  await owner.user.deleteMany({ where: { id: { in: actors } } });
  await Promise.all([owner.$disconnect(), runtime.$disconnect()]);
});

describe("production under the actual runtime grants", () => {
  it("reproduces missing Phase 3 grants and repairs page reads with the reviewed provider scripts", async () => {
    const provider = new Client({ connectionString: url }); await provider.connect();
    const before = await owner.auditEvent.count();
    const repair = async () => {
      await runSqlFile(provider, "supabase/policies/production-runtime.sql");
      await runSqlFile(provider, "supabase/policies/crop-cycle-runtime.sql");
      await runSqlFile(provider, "supabase/policies/poultry-batch-runtime.sql");
    };
    try {
      await provider.query('REVOKE SELECT, INSERT ON "Enterprise", "Season", "CropCatalog", "CropCycle", "AnimalTypeCatalog", "PoultryBatch" FROM myfarm_runtime');
      await expect(production("a").listEnterprises(farmA)).rejects.toThrow(denied);
      await expect(production("a").listSeasons(farmA)).rejects.toThrow(denied);
      await expect(poultry("a").list(farmA)).rejects.toThrow(denied);
      await expect(poultry("a").animalTypes(farmA)).rejects.toThrow(denied);
      await repair();
      await expect(production("a").listEnterprises(farmA)).resolves.toEqual({ items: [], nextCursor: null });
      await expect(production("a").listSeasons(farmA)).resolves.toEqual({ items: [], nextCursor: null });
      await expect(poultry("a").list(farmA)).resolves.toEqual({ items: [], nextCursor: null });
      expect((await poultry("a").animalTypes(farmA)).items).toHaveLength(4);
      await expect(poultry("b").list(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(production("b").listEnterprises(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await provider.query(`SELECT
        has_table_privilege('myfarm_runtime','"CropCatalog"','SELECT') AS catalog_read,
        has_table_privilege('myfarm_runtime','"CropCatalog"','INSERT') AS catalog_write,
        has_table_privilege('myfarm_runtime','"CropCycle"','INSERT') AS cycle_insert,
        has_table_privilege('myfarm_runtime','"AnimalTypeCatalog"','INSERT') AS animal_write,
        has_table_privilege('myfarm_runtime','"PoultryBatch"','INSERT') AS poultry_insert,
        has_table_privilege('myfarm_runtime','"PoultryBatch"','DELETE') AS poultry_delete,
        has_table_privilege('authenticated','"PoultryBatch"','SELECT') AS poultry_browser_read,
        has_table_privilege('anon','"Enterprise"','SELECT') AS browser_read,
        has_table_privilege('myfarm_runtime','"Enterprise"','DELETE') AS runtime_delete`)).rows[0]).toEqual({ catalog_read: true, catalog_write: false, cycle_insert: true, animal_write: false, poultry_insert: true, poultry_delete: false, poultry_browser_read: false, browser_read: false, runtime_delete: false });
      expect(await owner.auditEvent.count()).toBe(before);
    } finally { await repair(); await provider.end(); }
  });
  it("creates and reads scoped enterprises/seasons, with server-owned version and audit metadata", async () => {
    expect(await runtime.$queryRaw`SELECT current_user AS role`).toEqual([{ role: "myfarm_runtime" }]);
    const input = enterpriseInput(); const row = await production("a").createEnterprise(farmA, input); enterpriseA = row.enterpriseId;
    expect(row).toMatchObject({ name: "Maize", type: "CROP", tenantId: tenantA, farmId: farmA, createdBy: users.a, status: "ACTIVE", version: 1 });
    const cycle = await production("a").createSeason(farmA, seasonInput()); seasonA = cycle.seasonId;
    expect(cycle).toMatchObject({ label: "Season A", startDate: "2026-03-01", endDate: "2026-08-01", tenantId: tenantA, farmId: farmA, version: 1 });
    expect(await production("a").enterprise(farmA, enterpriseA)).toEqual(row);
    expect(await production("a").season(farmA, seasonA)).toEqual(cycle);
    expect((await owner.auditEvent.findMany({ where: { requestId: input.requestId } }))).toEqual([expect.objectContaining({ actorId: users.a, tenantId: tenantA, action: "ENTERPRISE_CREATED", targetId: enterpriseA })]);
  });
  it("keeps multiple farms within one tenant separate, including nested IDs and plot references", async () => {
    await production("a").createEnterprise(farmA2, enterpriseInput("Coffee"));
    await production("a").createSeason(farmA2, seasonInput("Second farm"));
    expect((await production("a").listEnterprises(farmA2)).items.map(row => row.name)).toEqual(["Coffee"]);
    await expect(production("a").enterprise(farmA2, enterpriseA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(production("a").season(farmA2, seasonA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const repo = productionRepository(runtime);
    expect(await repo.plot(scope(), plotA)).toMatchObject({ plotId: plotA, tenantId: tenantA, farmId: farmA });
    expect(await repo.plot(scope(), plotA2)).toBeNull();
    expect(await repo.plot({ tenantId: tenantB, farmId: farmB }, plotA)).toBeNull();
  });
  it("denies another user, a guessed farm, and ADMIN even with farm membership", async () => {
    for (const who of ["b", "admin"] as const) {
      await expect(production(who).listEnterprises(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(production(who).season(farmA, seasonA)).rejects.toMatchObject({ code: "FORBIDDEN" });
      const input = enterpriseInput("Forged");
      await expect(production(who).createEnterprise(farmA, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
    }
    await expect(production("a").listSeasons(id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await production("b").listSeasons(farmB)).items).toEqual([]);
  });
  it("scopes list cursors and handles ties without repeats or missing rows", async () => {
    for (let n = 0; n < 4; n++) await production("a").createEnterprise(farmA, enterpriseInput("Page " + n));
    await owner.enterprise.updateMany({ where: { farmId: farmA }, data: { createdAt: new Date("2026-10-18T00:00:00Z") } });
    const seen: string[] = []; let cursor: string | undefined;
    do {
      const page = await production("a").listEnterprises(farmA, { cursor, limit: 2 });
      seen.push(...page.items.map(row => row.enterpriseId)); cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(await owner.enterprise.count({ where: { farmId: farmA } }));
    await expect(production("a").listEnterprises(farmA2, { cursor: enterpriseA })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(production("a").listSeasons(farmA2, { cursor: seasonA })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(production("a").listSeasons(farmA, { cursor: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("persists overlapping seasons and optional end dates with bounded pagination", async () => {
    await production("a").createSeason(farmA, seasonInput("Overlap"));
    const open = await production("a").createSeason(farmA, { requestId: id(), label: "Open ended", startDate: "2026-01-01", endDate: "" });
    expect(open.endDate).toBeNull();
    const first = await production("a").listSeasons(farmA, { limit: 1 });
    expect(first.items).toHaveLength(1); expect(first.nextCursor).not.toBeNull();
    const second = await production("a").listSeasons(farmA, { cursor: first.nextCursor, limit: 1 });
    expect(second.items[0].seasonId).not.toBe(first.items[0].seasonId);
  });
});

describe("atomic audit receipts and current authorization", () => {
  it("concurrent duplicate enterprise and season commands produce exactly one effect each", async () => {
    const input = enterpriseInput("Concurrent"), season = seasonInput("Concurrent");
    const rows = await Promise.all(Array.from({ length: 6 }, () => production("a").createEnterprise(farmA, input)));
    expect(new Set(rows.map(row => row.enterpriseId)).size).toBe(1);
    const seasons = await Promise.all(Array.from({ length: 6 }, () => production("a").createSeason(farmA, season)));
    expect(new Set(seasons.map(row => row.seasonId)).size).toBe(1);
    expect(await owner.enterprise.count({ where: { farmId: farmA, name: input.name } })).toBe(1);
    expect(await owner.season.count({ where: { farmId: farmA, label: season.label } })).toBe(1);
    expect(await owner.auditEvent.count({ where: { requestId: { in: [input.requestId, season.requestId] } } })).toBe(2);
  });
  it("conflicts on changed payload or changed farm under the same receipt", async () => {
    const input = enterpriseInput("Original"); await production("a").createEnterprise(farmA, input);
    await expect(production("a").createEnterprise(farmA, { ...input, name: "Changed" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(production("a").createEnterprise(farmA2, input)).rejects.toMatchObject({ code: "CONFLICT" });
    const season = seasonInput("Original"); await production("a").createSeason(farmA, season);
    await expect(production("a").createSeason(farmA, { ...season, endDate: "2026-09-01" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(production("a").createSeason(farmA2, season)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: { in: [input.requestId, season.requestId] } } })).toBe(2);
  });
  it("rolls the receipt back on database failure, then accepts a corrected retry", async () => {
    const repo = productionRepository(runtime), input = enterpriseInput("x".repeat(121));
    await expect(repo.createEnterprise(scope(), input)).rejects.toThrow();
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
    await expect(production("a").createEnterprise(farmA, { ...input, name: "Corrected" })).resolves.toMatchObject({ name: "Corrected" });
    const season = { ...seasonInput(), endDate: "2025-01-01" };
    await expect(repo.createSeason(scope(), season)).rejects.toThrow();
    expect(await owner.auditEvent.count({ where: { requestId: season.requestId } })).toBe(0);
    await expect(production("a").createSeason(farmA, { ...season, endDate: "2026-08-01" })).resolves.toMatchObject({ version: 1 });
  });
  it("rejects revoked farm or tenant membership on new writes and retries", async () => {
    const input = enterpriseInput("Before revocation"); await production("a").createEnterprise(farmA, input);
    await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "REVOKED" } });
    try {
      await expect(production("a").createEnterprise(farmA, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(productionRepository(runtime).createEnterprise(scope(), enterpriseInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(production("a").listSeasons(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally { await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "ACTIVE" } }); }
    await owner.membership.update({ where: { userId_organizationId: { userId: users.a, organizationId: tenantA } }, data: { status: "REVOKED" } });
    try {
      await expect(production("a").createEnterprise(farmA, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(productionRepository(runtime).createSeason(scope(), seasonInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally { await owner.membership.update({ where: { userId_organizationId: { userId: users.a, organizationId: tenantA } }, data: { status: "ACTIVE" } }); }
  });
  it("rejects suspended accounts and unverified sessions without recording a command", async () => {
    const input = enterpriseInput(); await owner.user.update({ where: { id: users.a }, data: { status: "SUSPENDED" } });
    try {
      await expect(production("a").createEnterprise(farmA, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(productionRepository(runtime).createEnterprise(scope(), input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally { await owner.user.update({ where: { id: users.a }, data: { status: "ACTIVE" } }); }
    const expired = new ProductionService(new AuthorizationService({ currentIdentity: async () => null }, identityRepository(runtime)), registryRepository(runtime), productionRepository(runtime));
    await expect(expired.createEnterprise(farmA, input)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
  });
  it("rechecks membership after waiting on a concurrent audit receipt", async () => {
    const blocker = new Client({ connectionString: url }); await blocker.connect();
    const input = enterpriseInput("Blocked retry");
    let attempt: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query('INSERT INTO "AuditEvent" (id, "actorId", "tenantId", action, "targetId", "requestId") VALUES ($1, $2, $3, \'ENTERPRISE_CREATED\', $4, $5)', [id(), users.a, tenantA, id(), input.requestId]);
      attempt = production("a").createEnterprise(farmA, input).then(value => value, (error: unknown) => error);
      let waiting = false;
      for (let n = 0; n < 100 && !waiting; n++) {
        const rows = await owner.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%AuditEvent%' AND pid <> pg_backend_pid()) AS waiting`;
        waiting = rows[0].waiting;
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "REVOKED" } });
      await blocker.query("ROLLBACK");
      expect(await attempt).toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
      expect(await owner.enterprise.count({ where: { farmId: farmA, name: input.name } })).toBe(0);
    } finally {
      await blocker.query("ROLLBACK"); await blocker.end(); if (attempt) await attempt;
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "ACTIVE" } });
    }
  });
});

describe("runtime policies are a consistency backstop", () => {
  it("rejects forged creators, privileged roles, non-initial status and version", async () => {
    const data = { tenantId: tenantA, farmId: farmA, createdBy: users.b, name: "Forbidden", type: "CROP" as const };
    await expect(runtime.enterprise.create({ data })).rejects.toThrow(denied);
    await expect(runtime.enterprise.create({ data: { ...data, createdBy: users.admin } })).rejects.toThrow(denied);
    await expect(runtime.enterprise.create({ data: { ...data, createdBy: users.a, status: "CLOSED" } })).rejects.toThrow(denied);
    await expect(runtime.enterprise.create({ data: { ...data, createdBy: users.a, version: 2 } })).rejects.toThrow(denied);
    await expect(runtime.season.create({ data: { tenantId: tenantA, farmId: farmA, createdBy: users.b, label: "Forbidden", startDate: new Date("2026-01-01") } })).rejects.toThrow(denied);
  });
  it("has no record-field update/delete privileges and grants browser roles no access", async () => {
    await expect(runtime.enterprise.updateMany({ where: { id: enterpriseA }, data: { farmId: farmA2 } })).rejects.toThrow(denied);
    await expect(runtime.enterprise.deleteMany({ where: { id: enterpriseA } })).rejects.toThrow(denied);
    await expect(runtime.season.updateMany({ where: { id: seasonA }, data: { label: "Rewritten history" } })).rejects.toThrow(denied);
    await expect(runtime.season.deleteMany({ where: { id: seasonA } })).rejects.toThrow(denied);
    for (const role of ["anon", "authenticated"]) {
      for (const table of ["Enterprise", "Season"]) {
        await expect(owner.$transaction(async tx => {
          await tx.$executeRawUnsafe("SET LOCAL ROLE " + role);
          await tx.$queryRawUnsafe('SELECT count(*) FROM "' + table + '"');
        })).rejects.toThrow(denied);
      }
    }
  });
});
