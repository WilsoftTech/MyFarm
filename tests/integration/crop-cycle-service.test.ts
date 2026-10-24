import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { ProductionClosureService } from "@/modules/enterprises-seasons/application/closure";
import { closureRepository } from "@/modules/enterprises-seasons/infrastructure/closure-repository";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ProductionService } from "@/modules/enterprises-seasons/application/production";
import { productionRepository } from "@/modules/enterprises-seasons/infrastructure/repository";
import { CropCycleService } from "@/modules/enterprises-seasons/application/crop-cycle";
import { cropCycleRepository } from "@/modules/enterprises-seasons/infrastructure/crop-cycle-repository";
import { startCropCycleSchema } from "@/modules/enterprises-seasons/contracts/crop-cycle";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Crop tests require isolated loopback myfarm_phase01_test database.");
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
const id = () => crypto.randomUUID();
const users = { a: id(), b: id(), admin: id() }, subjects = { a: id(), b: id(), admin: id() };
const auth = (who: keyof typeof users) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime));
const registry = (who: keyof typeof users) => new FarmerRegistryService(auth(who), registryRepository(runtime));
const production = (who: keyof typeof users) => new ProductionService(auth(who), registryRepository(runtime), productionRepository(runtime));
const service = (who: keyof typeof users = "a") => new CropCycleService(auth(who), registryRepository(runtime), cropCycleRepository(runtime));
const closure = (who: keyof typeof users = "a") => new ProductionClosureService(auth(who), registryRepository(runtime), closureRepository(runtime));
const closeInput = () => ({ requestId: id(), expectedVersion: 1, confirmed: true });
const maize = "f4030005-0000-4000-8000-000000000001", coffee = "f4030005-0000-4000-8000-000000000002";
let tenantA: string, tenantB: string, farmA: string, farmA2: string, farmB: string;
const catalogFixture = id();
const scope = () => ({ actorId: users.a, tenantId: tenantA, farmId: farmA });
async function command(farm = farmA, who: "a" | "b" = "a", area: string | undefined = "1") {
  const enterprise = await production(who).createEnterprise(farm, { requestId: id(), name: "Crop " + id(), type: "CROP" });
  const season = await production(who).createSeason(farm, { requestId: id(), label: "Season " + id(), startDate: "2026-03-01" });
  const plot = await registry(who).createPlot(farm, { requestId: id(), name: "Plot " + id(), area, areaUnit: area === undefined ? undefined : "ACRE" });
  return { requestId: id(), enterpriseId: enterprise.enterpriseId, seasonId: season.seasonId, plotId: plot.plotId, cropId: maize, areaPlanted: "0.1", areaUnit: "ACRE" as const, plantingDate: "2026-03-01" };
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
  const profile = (name: string) => ({ requestId: id(), name, phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] });
  tenantA = (await registry("a").register(profile("Crop A"))).tenantId; tenantB = (await registry("b").register(profile("Crop B"))).tenantId;
  const farm = (name: string) => ({ requestId: id(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" });
  farmA = (await registry("a").createFarm(farm("A"))).farmId; farmA2 = (await registry("a").createFarm(farm("A2"))).farmId; farmB = (await registry("b").createFarm(farm("B"))).farmId;
  await owner.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
  await owner.farmMember.create({ data: { userId: users.admin, farmId: farmA, tenantId: tenantA, role: "OWNER" } });
  await owner.cropCatalog.create({ data: { id: catalogFixture, name: "Synthetic crop " + catalogFixture } });
}, 30_000);
afterAll(async () => {
  const tenants = [tenantA, tenantB].filter(Boolean), actors = Object.values(users);
  try {
    await owner.cropCycle.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.cropCatalog.deleteMany({ where: { id: catalogFixture } });
    await owner.enterprise.deleteMany({ where: { tenantId: { in: tenants } } }); await owner.season.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } }); await owner.plot.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.farmMember.deleteMany({ where: { userId: { in: actors } } }); await owner.farm.deleteMany({ where: { tenantId: { in: tenants } } });
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } }); await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
    await owner.membership.deleteMany({ where: { userId: { in: actors } } }); await owner.organization.deleteMany({ where: { id: { in: tenants } } }); await owner.user.deleteMany({ where: { id: { in: actors } } });
  } finally { await Promise.all([owner.$disconnect(), runtime.$disconnect()]); }
});

describe("crop persistence with real restricted runtime role", () => {
  it("selects and plants every released crop without crop-specific code, with concurrent retry safety", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => "f4030011-0000-4000-8000-" + String(index + 1).padStart(12, "0"));
    const released = await owner.cropCatalog.findMany({ where: { id: { in: ids } } });
    expect(released).toHaveLength(12);
    const choices = (await service().crops(farmA)).items;
    for (const crop of released) {
      expect(choices).toContainEqual({ cropId: crop.id, name: crop.name });
      const input = { ...await command(), cropId: crop.id };
      const rows = await Promise.all([service().start(farmA, input), service().start(farmA, input)]);
      expect(rows[0]).toEqual(rows[1]);
      expect(rows[0]).toMatchObject({ cropId: crop.id, cropName: crop.name });
      expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
      await expect(service("b").start(farmA, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it.each(["DAIRY", "LIVESTOCK", "FISH", "OTHER"])("exposes no workflow for %s and refuses crop starts without receipts", async type => {
    const enterprise = await production("a").createEnterprise(farmA, { requestId: id(), name: "Unsupported " + id(), type });
    expect(enterprise.workflow).toBeNull();
    expect((await production("a").enterprise(farmA, enterprise.enterpriseId)).workflow).toBeNull();
    const input = { ...await command(), enterpriseId: enterprise.enterpriseId };
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
  });
  it("provides bounded scoped plot choices/detail and rejects foreign or missing anchors", async () => {
    const input = await command(), other = await command(farmA2);
    expect(await service().plot(farmA, input.plotId)).toMatchObject({ plotId: input.plotId, farmId: farmA, tenantId: tenantA, area: "1", areaUnit: "ACRE" });
    await expect(service().plot(farmA2, input.plotId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service("b").plots(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service("admin").plot(farmA, input.plotId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await command();
    const first = await service().plots(farmA, { limit: 1 }); expect(first.items).toHaveLength(1); expect(first.nextCursor).not.toBeNull();
    const second = await service().plots(farmA, { limit: 1, cursor: first.nextCursor }); expect(second.items[0].plotId).not.toBe(first.items[0].plotId);
    for (const cursor of [other.plotId, id()]) await expect(service().plots(farmA, { cursor })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("stores exact values, optional variety/open perennial, trusted metadata and atomic audit", async () => {
    const input = { ...await command(), cropId: coffee, areaPlanted: "000.100000", variety: " ", expectedHarvest: "" };
    const row = await service().start(farmA, input);
    expect(await runtime.$queryRaw`SELECT current_user AS role`).toEqual([{ role: "myfarm_runtime" }]);
    expect(row).toMatchObject({ farmId: farmA, tenantId: tenantA, areaPlanted: "0.1", cropName: "Coffee", variety: null, expectedHarvest: null, status: "ACTIVE", version: 1, createdBy: users.a });
    expect(await service().cycle(farmA, row.cycleId)).toEqual(row);
    expect(await owner.auditEvent.findMany({ where: { requestId: input.requestId } })).toEqual([expect.objectContaining({ action: "CROP_CYCLE_STARTED", targetId: row.cycleId, actorId: users.a, tenantId: tenantA })]);
  });
  it("reads an approved, bounded data catalog and hides inactive entries", async () => {
    const names = (await service().crops(farmA)).items.map(c => c.name);
    expect(names).toEqual(expect.arrayContaining(["Maize", "Coffee", "Synthetic crop " + catalogFixture]));
    const first = await service().crops(farmA, { limit: 1 }); expect(first.items).toHaveLength(1);
    expect((await service().crops(farmA, { limit: 1, cursor: first.nextCursor })).items[0].cropId).not.toBe(first.items[0].cropId);
    await owner.cropCatalog.update({ where: { id: catalogFixture }, data: { active: false } });
    try { expect((await service().crops(farmA)).items.map(c => c.cropId)).not.toContain(catalogFixture); }
    finally { await owner.cropCatalog.update({ where: { id: catalogFixture }, data: { active: true } }); }
    await expect(service().crops(farmA, { cursor: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("preserves minimum/maximum decimal areas and rejects invalid dates/precision without receipts", async () => {
    const input = await command(farmA, "a", "999999999999.999999");
    expect(await service().start(farmA, { ...input, areaPlanted: "999999999999.999999" })).toMatchObject({ areaPlanted: "999999999999.999999" });
    expect(await service().start(farmA, { ...await command(), areaPlanted: "0.000001" })).toMatchObject({ areaPlanted: "0.000001" });
    for (const change of [{ expectedHarvest: "2026-02-28" }, { plantingDate: "2026-02-29" }, { areaPlanted: "0.0000001" }]) {
      const bad = { ...input, requestId: id(), ...change };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
  });
  it("separates same-tenant farms, cross-user tenants, nested IDs and pagination cursors", async () => {
    const input = await command(), row = await service().start(farmA, input);
    const other = await service().start(farmA2, await command(farmA2));
    await expect(service().cycle(farmA2, row.cycleId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service().list(farmA2, { cursor: row.cycleId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service().cycle(farmA, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const who of ["b", "admin"] as const) {
      for (const action of [() => service(who).start(farmA, input), () => service(who).cycle(farmA, row.cycleId), () => service(who).list(farmA), () => service(who).crops(farmA)]) await expect(action()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect((await service().list(farmA2)).items.map(c => c.cycleId)).toEqual([other.cycleId]);
    const foreign = await command(farmB, "b");
    for (const key of ["enterpriseId", "seasonId", "plotId"] as const) {
      const bad = { ...input, requestId: id(), [key]: foreign[key] };
      await expect(service().start(farmA, bad)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: bad.requestId } })).toBe(0);
    }
  });
  it("paginates tied creation times without omissions or duplicates", async () => {
    const input = await command(farmA2);
    for (let n = 0; n < 4; n++) await service().start(farmA2, { ...input, requestId: id() });
    await owner.cropCycle.updateMany({ where: { farmId: farmA2 }, data: { createdAt: new Date("2026-10-18T00:00:00Z") } });
    const seen: string[] = []; let cursor: string | undefined;
    do { const page = await service().list(farmA2, { limit: 2, cursor }); seen.push(...page.items.map(c => c.cycleId)); cursor = page.nextCursor ?? undefined; } while (cursor);
    expect(new Set(seen).size).toBe(seen.length); expect(seen.length).toBe(await owner.cropCycle.count({ where: { farmId: farmA2 } }));
  });
  it("checks total plot area across enterprises/seasons and persists a specific exception reason", async () => {
    const input = { ...await command(), areaPlanted: "0.7" }; await service().start(farmA, input);
    const next = await command();
    const excess = { ...next, plotId: input.plotId, areaPlanted: "0.300001" };
    await expect(service().start(farmA, excess)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await owner.auditEvent.count({ where: { requestId: excess.requestId } })).toBe(0);
    expect(await service().start(farmA, { ...excess, areaExceptionReason: " Owner records intercropping overlap " })).toMatchObject({ areaExceptionReason: "Owner records intercropping overlap", areaPlanted: "0.300001" });
    await expect(service().start(farmA, { ...excess, requestId: id(), areaPlanted: "0.000001" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("checks all allocations, including beyond the default list page", async () => {
    const input = { ...await command(), areaPlanted: "0.01" };
    for (let n = 0; n < 21; n++) await service().start(farmA, { ...input, requestId: id() });
    await expect(service().start(farmA, { ...input, requestId: id(), areaPlanted: "0.8" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await owner.cropCycle.count({ where: { plotId: input.plotId } })).toBe(21);
  });
  it("never uses an expected harvest to free active area; closed cycles release it", async () => {
    const input = { ...await command(), areaPlanted: "1", expectedHarvest: "2026-03-01" }, row = await service().start(farmA, input);
    await expect(service().start(farmA, { ...input, requestId: id(), plantingDate: "2026-09-01", expectedHarvest: "" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    // Owner-only fixture simulates a future reviewed closure command; no runtime UPDATE exists.
    await owner.cropCycle.update({ where: { id: row.cycleId }, data: { status: "CLOSED" } });
    await expect(service().start(farmA, { ...input, requestId: id() })).resolves.toMatchObject({ status: "ACTIVE" });
  });
  it("rejects absent area, mixed units, inactive/missing catalog and closed/wrong-type parents", async () => {
    const input = await command();
    await owner.plot.update({ where: { id: input.plotId }, data: { area: null, areaUnit: null } });
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await owner.plot.update({ where: { id: input.plotId }, data: { area: "1", areaUnit: "HECTARE" } });
    await expect(service().start(farmA, { ...input, areaExceptionReason: "Cannot bypass unit mismatch" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await owner.plot.update({ where: { id: input.plotId }, data: { areaUnit: "ACRE" } });
    await expect(service().start(farmA, { ...input, cropId: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await owner.cropCatalog.update({ where: { id: catalogFixture }, data: { active: false } });
    try { await expect(service().start(farmA, { ...input, cropId: catalogFixture })).rejects.toMatchObject({ code: "CONFLICT" }); }
    finally { await owner.cropCatalog.update({ where: { id: catalogFixture }, data: { active: true } }); }
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { type: "POULTRY" } });
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { type: "CROP", status: "CLOSED" } });
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "CONFLICT" });
    await owner.enterprise.update({ where: { id: input.enterpriseId }, data: { status: "ACTIVE" } });
    await owner.season.update({ where: { id: input.seasonId }, data: { status: "CLOSED" } });
    await expect(service().start(farmA, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
  });
});

describe("atomicity, idempotency and concurrency", () => {
  it("concurrent duplicates allocate and audit exactly once, including a full plot retry", async () => {
    const input = { ...await command(), areaPlanted: "1" };
    const rows = await Promise.all(Array.from({ length: 6 }, () => service().start(farmA, input)));
    expect(new Set(rows.map(r => r.cycleId)).size).toBe(1);
    expect(await owner.cropCycle.count({ where: { plotId: input.plotId } })).toBe(1);
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
    expect(await service().start(farmA, { ...input, areaPlanted: "01.000000" })).toEqual(rows[0]);
  });
  it("serializes independent competing starts so capacity cannot be oversubscribed", async () => {
    const input = { ...await command(), areaPlanted: "0.6" };
    const results = await Promise.allSettled([service().start(farmA, input), service().start(farmA, { ...input, requestId: id() })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toEqual([expect.objectContaining({ reason: expect.objectContaining({ code: "INVALID_INPUT" }) })]);
    expect(await owner.cropCycle.count({ where: { plotId: input.plotId } })).toBe(1);
    expect(await owner.auditEvent.count({ where: { action: "CROP_CYCLE_STARTED", targetId: { in: (await owner.cropCycle.findMany({ where: { plotId: input.plotId } })).map(r => r.id) } } })).toBe(1);
  });
  it("conflicts on each changed creation field or farm, without another receipt/effect", async () => {
    const input = await command(); await service().start(farmA, input);
    for (const change of [{ cropId: coffee }, { enterpriseId: id() }, { seasonId: id() }, { plotId: id() }, { variety: "Changed" }, { areaPlanted: "0.2" }, { areaUnit: "HECTARE" }, { plantingDate: "2026-03-02" }, { expectedHarvest: "2026-08-01" }, { areaExceptionReason: "Changed" }]) await expect(service().start(farmA, { ...input, ...change })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service().start(farmA2, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
  });
  it("replays committed creation after catalog/parent lifecycle changes without rewriting its snapshot", async () => {
    const input = { ...await command(), cropId: catalogFixture }, row = await service().start(farmA, input);
    await owner.cropCatalog.update({ where: { id: catalogFixture }, data: { active: false, name: "Renamed " + catalogFixture } });
    await owner.season.update({ where: { id: input.seasonId }, data: { status: "CLOSED" } });
    try { expect(await service().start(farmA, input)).toEqual(row); }
    finally { await owner.cropCatalog.update({ where: { id: catalogFixture }, data: { active: true, name: "Synthetic crop " + catalogFixture } }); }
  });
  it("rolls the audit receipt back on database failure and accepts a corrected retry", async () => {
    const input = { ...startCropCycleSchema.parse(await command()), variety: "x".repeat(121) };
    await expect(cropCycleRepository(runtime).startCropCycle(scope(), input)).rejects.toThrow();
    expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
    expect(await owner.cropCycle.count({ where: { plotId: input.plotId } })).toBe(0);
    await expect(service().start(farmA, { ...input, variety: "Corrected" })).resolves.toMatchObject({ variety: "Corrected" });
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
        await expect(cropCycleRepository(runtime).startCropCycle(scope(), startCropCycleSchema.parse({ ...input, requestId: id() }))).rejects.toMatchObject({ code: "FORBIDDEN" });
      } finally { await set(false); }
    }
    const expired = new CropCycleService(new AuthorizationService({ currentIdentity: async () => null }, identityRepository(runtime)), registryRepository(runtime), cropCycleRepository(runtime));
    await expect(expired.start(farmA, input)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it.each(["receipt", "plot"] as const)("rechecks authorization after waiting on a %s lock", async kind => {
    const input = await command(), blocker = new Client({ connectionString: url }); await blocker.connect(); let attempt: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      if (kind === "receipt") await blocker.query('INSERT INTO "AuditEvent" (id, "actorId", "tenantId", action, "targetId", "requestId") VALUES ($1,$2,$3,\'CROP_CYCLE_STARTED\',$4,$5)', [id(), users.a, tenantA, id(), input.requestId]);
      else await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["myfarm:crop-plot:" + input.plotId]);
      attempt = service().start(farmA, input).then(r => r, (error: unknown) => error);
      await waitForLock(kind === "receipt" ? "%AuditEvent%" : "%pg_advisory_xact_lock%");
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "REVOKED" } });
      await blocker.query("ROLLBACK"); expect(await attempt).toMatchObject({ code: "FORBIDDEN" });
      expect(await owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
      expect(await owner.cropCycle.count({ where: { plotId: input.plotId } })).toBe(0);
    } finally {
      await blocker.query("ROLLBACK"); await blocker.end(); if (attempt) await attempt;
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "ACTIVE" } });
    }
  });
});

describe("database constraints and least privilege", () => {
  it("rejects cross-farm and cross-tenant parent combinations at the database boundary", async () => {
    const input = await command(), foreign = await command(farmA2), row = await service().start(farmA, input);
    const original = await owner.cropCycle.findUniqueOrThrow({ where: { id: row.cycleId } });
    for (const key of ["enterpriseId", "seasonId", "plotId"] as const) await expect(owner.cropCycle.create({ data: { ...original, id: id(), [key]: foreign[key] } })).rejects.toMatchObject({ code: "P2003" });
    await expect(owner.cropCycle.create({ data: { ...original, id: id(), tenantId: tenantB } })).rejects.toMatchObject({ code: "P2003" });
  });
  it("enforces positive finite area, dates, nonblank strings and versions", async () => {
    const row = await service().start(farmA, await command());
    for (const expression of ['"areaPlanted" = 0', '"areaPlanted" = -1', '"areaPlanted" = \'NaN\'', 'version = 0', 'variety = \'   \'', '"areaExceptionReason" = \'   \'', '"cropName" = \'\'', '"plantingDate" = \'infinity\'', '"expectedHarvest" = \'infinity\'', '"expectedHarvest" = \'2025-01-01\'']) await expect(owner.$executeRawUnsafe('UPDATE "CropCycle" SET ' + expression + ' WHERE id = $1::uuid', row.cycleId)).rejects.toThrow();
  });
  it("permits no runtime record-field updates/deletes, catalog writes or browser-role access", async () => {
    const row = await service().start(farmA, await command()), data = await owner.cropCycle.findUniqueOrThrow({ where: { id: row.cycleId } });
    const denied = /permission denied|row-level security/i;
    for (const change of [{ createdBy: users.b }, { createdBy: users.admin }, { status: "CLOSED" as const }, { version: 2 }]) await expect(runtime.cropCycle.create({ data: { ...data, id: id(), ...change } })).rejects.toThrow(denied);
    await expect(runtime.cropCycle.updateMany({ where: { id: row.cycleId }, data: { areaPlanted: "2" } })).rejects.toThrow(denied);
    await expect(runtime.cropCycle.deleteMany({ where: { id: row.cycleId } })).rejects.toThrow(denied);
    await expect(runtime.cropCatalog.create({ data: { id: id(), name: "Forbidden" } })).rejects.toThrow(denied);
    await expect(runtime.cropCatalog.updateMany({ data: { active: false } })).rejects.toThrow(denied);
    await expect(runtime.cropCatalog.deleteMany({ where: { id: catalogFixture } })).rejects.toThrow(denied);
    for (const role of ["anon", "authenticated"]) for (const table of ["CropCycle", "CropCatalog"]) await expect(owner.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE " + role); await tx.$queryRawUnsafe('SELECT * FROM "' + table + '"');
    })).rejects.toThrow(denied);
  });
});


describe("final crop-cycle and season closure", () => {
  it("blocks active seasons, closes exactly once, preserves history and releases plot capacity", async () => {
    const input = await command(), cycle = await service().start(farmA, { ...input, areaPlanted: "1" });
    const blocked = closeInput();
    await expect(closure().close(farmA, "SEASON", input.seasonId, blocked)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { requestId: blocked.requestId } })).toBe(0);
    const close = closeInput(), results = await Promise.all(Array.from({ length: 6 }, () => closure().close(farmA, "CROP_CYCLE", cycle.cycleId, close)));
    expect(results).toEqual(Array.from({ length: 6 }, () => ({ recordId: cycle.cycleId, status: "CLOSED", version: 2 })));
    expect(await owner.auditEvent.count({ where: { requestId: close.requestId, action: "CROP_CYCLE_CLOSED" } })).toBe(1);
    expect(await service().cycle(farmA, cycle.cycleId)).toMatchObject({ status: "CLOSED", version: 2, areaPlanted: "1", plotId: input.plotId });
    const replacement = await service().start(farmA, { ...input, requestId: id(), areaPlanted: "1" });
    await expect(closure().close(farmA, "SEASON", input.seasonId, blocked)).rejects.toMatchObject({ code: "CONFLICT" });
    await closure().close(farmA, "CROP_CYCLE", replacement.cycleId, closeInput());
    expect(await closure().close(farmA, "SEASON", input.seasonId, blocked)).toEqual({ recordId: input.seasonId, status: "CLOSED", version: 2 });
    expect(await closure().close(farmA, "SEASON", input.seasonId, blocked)).toMatchObject({ version: 2 });
    await expect(service().start(farmA, { ...input, requestId: id() })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await service().list(farmA)).items.some(row => row.cycleId === cycle.cycleId)).toBe(true);
    expect(await runtime.cropCycle.updateMany({ where: { id: cycle.cycleId }, data: { status: "ACTIVE" } })).toEqual({ count: 0 });
    expect(await runtime.season.updateMany({ where: { id: input.seasonId }, data: { status: "ACTIVE" } })).toEqual({ count: 0 });
  });
  it("rejects stale versions, changed receipt targets, guessed farms, other users and ADMIN", async () => {
    const input = await command(), row = await service().start(farmA, input), close = closeInput();
    for (const who of ["b", "admin"] as const) await expect(closure(who).close(farmA, "CROP_CYCLE", row.cycleId, close)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(closure().close(farmA2, "CROP_CYCLE", row.cycleId, close)).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const change of [{ confirmed: false }, { tenantId: tenantA }]) await expect(closure().close(farmA, "CROP_CYCLE", row.cycleId, { ...close, ...change })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(closure().close(farmA, "CROP_CYCLE", row.cycleId, { ...close, expectedVersion: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
    await closure().close(farmA, "CROP_CYCLE", row.cycleId, close);
    await expect(closure().close(farmA, "CROP_CYCLE", row.cycleId, { ...close, expectedVersion: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
    const other = await service().start(farmA, { ...input, requestId: id() });
    await expect(closure().close(farmA, "CROP_CYCLE", other.cycleId, close)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await service().cycle(farmA, other.cycleId)).toMatchObject({ status: "ACTIVE", version: 1 });
  });
  it("serializes different close requests and concurrent season-close/crop-start", async () => {
    const input = await command(), row = await service().start(farmA, input);
    const attempts = await Promise.allSettled(Array.from({ length: 4 }, () => closure().close(farmA, "CROP_CYCLE", row.cycleId, closeInput())));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    for (const result of attempts) if (result.status === "rejected") expect(result.reason).toMatchObject({ code: "CONFLICT" });
    expect(await owner.auditEvent.count({ where: { targetId: row.cycleId, action: "CROP_CYCLE_CLOSED" } })).toBe(1);
    const empty = await command();
    const race = await Promise.allSettled([closure().close(farmA, "SEASON", empty.seasonId, closeInput()), service().start(farmA, empty)]);
    expect(race.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const season = await owner.season.findUniqueOrThrow({ where: { id: empty.seasonId } });
    const active = await owner.cropCycle.count({ where: { seasonId: empty.seasonId, status: "ACTIVE" } });
    expect({ status: season.status, active }).toEqual(race[0].status === "fulfilled" ? { status: "CLOSED", active: 0 } : { status: "ACTIVE", active: 1 });
  });
  it("rechecks membership after waiting for closure's season lock and rolls back the receipt", async () => {
    const input = await command(), row = await service().start(farmA, input), close = closeInput();
    const blocker = new Client({ connectionString: url }); await blocker.connect();
    let attempt: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["myfarm:production-season:" + input.seasonId]);
      attempt = closure().close(farmA, "CROP_CYCLE", row.cycleId, close); const observed = attempt.catch(() => {});
      await waitForLock("%pg_advisory_xact_lock%");
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "REVOKED" } });
      await blocker.query("COMMIT");
      await expect(attempt).rejects.toMatchObject({ code: "FORBIDDEN" }); await observed;
      expect(await owner.auditEvent.count({ where: { requestId: close.requestId } })).toBe(0);
      expect(await owner.cropCycle.findUnique({ where: { id: row.cycleId } })).toMatchObject({ status: "ACTIVE", version: 1 });
    } finally {
      await blocker.query("ROLLBACK"); await attempt?.catch(() => {}); await blocker.end();
      await owner.farmMember.update({ where: { farmId_userId: { farmId: farmA, userId: users.a } }, data: { status: "ACTIVE" } });
    }
  });
  it("rolls back both receipt and status if the final update fails", async () => {
    const input = await command(), row = await service().start(farmA, input), close = closeInput();
    const provider = new Client({ connectionString: url }); await provider.connect();
    try {
      await provider.query(`CREATE FUNCTION public.closure_failure_probe() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${row.cycleId}'::uuid THEN RAISE EXCEPTION 'synthetic closure failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER closure_failure_probe BEFORE UPDATE ON "CropCycle" FOR EACH ROW EXECUTE FUNCTION public.closure_failure_probe()`);
      await expect(closure().close(farmA, "CROP_CYCLE", row.cycleId, close)).rejects.toThrow("synthetic closure failure");
      expect(await owner.auditEvent.count({ where: { requestId: close.requestId } })).toBe(0);
      expect(await owner.cropCycle.findUnique({ where: { id: row.cycleId } })).toMatchObject({ status: "ACTIVE", version: 1 });
    } finally { await provider.query('DROP TRIGGER IF EXISTS closure_failure_probe ON "CropCycle"; DROP FUNCTION IF EXISTS public.closure_failure_probe()'); await provider.end(); }
  });
});
