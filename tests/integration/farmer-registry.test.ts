import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { config } from "dotenv";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { PrivateFileService } from "@/modules/engineering-foundation/application/private-files";
import { auditService } from "@/modules/engineering-foundation/infrastructure/audit";
import { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Integration requires isolated local myfarm_phase01_test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 10 }) });

const users = { a: crypto.randomUUID(), b: crypto.randomUUID(), admin: crypto.randomUUID(), racer: crypto.randomUUID() };
const subjects = Object.fromEntries(Object.keys(users).map(key => [key, crypto.randomUUID()])) as Record<keyof typeof users, string>;
const serviceFor = (who: keyof typeof users) => new FarmerRegistryService(new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(db)), registryRepository(db));
const profile = (name: string) => ({ requestId: crypto.randomUUID(), name, phone: "0772 123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS", "POULTRY"] });
const farmInput = (name: string) => ({ requestId: crypto.randomUUID(), name, district: "Rukungiri", ownershipType: "FAMILY", primaryActivity: "CROPS" });
let farmA: string, tenantA: string, tenantB: string;

beforeAll(async () => {
await db.user.createMany({ data: Object.entries(users).map(([key, id]) => ({ id, authSubject: subjects[key as keyof typeof users] })) });
tenantA = (await serviceFor("a").register(profile("Farmer A"))).tenantId;
tenantB = (await serviceFor("b").register(profile("Farmer B"))).tenantId;
farmA = (await serviceFor("a").createFarm({ ...farmInput("A home farm"), approximateAcreage: "2.5", latitude: "-0.790123", longitude: "29.926745" })).farmId;
// An administrator membership in A's tenant must not imply farm-data access.
await db.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
});
afterAll(async () => {
const ids = Object.values(users);
const tenants = (await db.membership.findMany({ where: { userId: { in: ids } }, select: { organizationId: true } })).map(m => m.organizationId);
await db.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
await db.plot.deleteMany({ where: { tenantId: { in: tenants } } });
await db.farmMember.deleteMany({ where: { tenantId: { in: tenants } } });
await db.farm.deleteMany({ where: { tenantId: { in: tenants } } });
await db.farmerProfile.deleteMany({ where: { farmer: { userId: { in: ids } } } });
await db.farmer.deleteMany({ where: { userId: { in: ids } } });
await db.membership.deleteMany({ where: { userId: { in: ids } } });
await db.organization.deleteMany({ where: { id: { in: tenants } } });
await db.user.deleteMany({ where: { id: { in: ids } } });
await db.$disconnect();
});

describe("exit journey and ownership (AC001)", () => {
it("register → create farm → create plots → view owned farm profile", async () => {
const a = serviceFor("a");
const me = await a.currentFarmer();
expect(me).toMatchObject({ name: "Farmer A", phone: "+256772123456", mainActivities: ["CROPS", "POULTRY"], version: 1, tenantId: tenantA });
await a.createPlot(farmA, { requestId: crypto.randomUUID(), name: "Plot A", area: "0.75", areaUnit: "ACRE" });
await a.createPlot(farmA, { requestId: crypto.randomUUID(), name: "Plot B" });
const farm = await a.farm(farmA);
expect(farm).toMatchObject({ name: "A home farm", approximateAcreage: "2.5", latitude: "-0.790123", longitude: "29.926745", tenantId: tenantA });
expect(farm.plots.map(p => [p.name, p.area, p.areaUnit])).toEqual([["Plot A", "0.75", "ACRE"], ["Plot B", null, null]]);
expect((await a.listFarms()).items).toEqual([expect.objectContaining({ farmId: farmA, plotCount: 2 })]);
const owner = await db.farm.findUniqueOrThrow({ where: { id: farmA }, include: { owner: true, members: true } });
expect(owner.owner.userId).toBe(users.a);
expect(owner.members).toEqual([expect.objectContaining({ userId: users.a, role: "OWNER", status: "ACTIVE" })]);
expect(await db.organization.findUniqueOrThrow({ where: { id: tenantA } })).toMatchObject({ kind: "PERSONAL" });
});
it("a user can register only once, including concurrent attempts, with no orphan organization", async () => {
await expect(serviceFor("a").register(profile("Again"))).rejects.toMatchObject({ code: "CONFLICT" });
const results = await Promise.allSettled([serviceFor("racer").register(profile("Racer")), serviceFor("racer").register(profile("Racer"))]);
expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
expect(await db.farmer.count({ where: { userId: users.racer } })).toBe(1);
expect(await db.membership.count({ where: { userId: users.racer } })).toBe(1);
});
it("a registration retried with the same request ID replays, even concurrently", async () => {
const replayUser = crypto.randomUUID(), replaySubject = crypto.randomUUID();
await db.user.create({ data: { id: replayUser, authSubject: replaySubject } });
const service = () => new FarmerRegistryService(new AuthorizationService({ currentIdentity: async () => ({ authSubject: replaySubject }) }, identityRepository(db)), registryRepository(db));
try {
const input = profile("Replay");
const results = await Promise.all([service().register(input), service().register(input), service().register(input)]);
expect(new Set(results.map(r => r.farmerId)).size).toBe(1);
expect(await service().register(input)).toEqual(results[0]);
await expect(service().register(profile("Replay"))).rejects.toMatchObject({ code: "CONFLICT" });
expect(await db.membership.count({ where: { userId: replayUser } })).toBe(1);
expect(await db.auditEvent.count({ where: { actorId: replayUser, action: "FARMER_REGISTERED" } })).toBe(1);
} finally {
const tenants = (await db.membership.findMany({ where: { userId: replayUser } })).map(m => m.organizationId);
await db.auditEvent.deleteMany({ where: { actorId: replayUser } });
await db.farmerProfile.deleteMany({ where: { farmer: { userId: replayUser } } });
await db.farmer.deleteMany({ where: { userId: replayUser } });
await db.membership.deleteMany({ where: { userId: replayUser } });
await db.organization.deleteMany({ where: { id: { in: tenants } } });
await db.user.delete({ where: { id: replayUser } });
}
});
it("database rejects foreign-tenant and orphan plots and farms", async () => {
const base = { name: "Forged", createdBy: users.b };
await expect(db.plot.create({ data: { ...base, id: crypto.randomUUID(), tenantId: tenantB, farmId: farmA } })).rejects.toThrow();
await expect(db.plot.create({ data: { ...base, id: crypto.randomUUID(), tenantId: tenantA, farmId: crypto.randomUUID() } })).rejects.toThrow();
const farmerA = await db.farmer.findUniqueOrThrow({ where: { userId: users.a } });
await expect(db.farm.create({ data: { ...base, id: crypto.randomUUID(), tenantId: tenantB, ownerFarmerId: farmerA.id, district: "R", ownershipType: "OWNED", primaryActivity: "CROPS" } })).rejects.toThrow();
await expect(db.farmMember.create({ data: { farmId: farmA, userId: users.b, tenantId: tenantB, role: "OWNER" } })).rejects.toThrow();
expect(await db.plot.count({ where: { name: "Forged" } })).toBe(0);
});
});

describe("tenant isolation and IDOR (AC004)", () => {
it("another farmer cannot list, read or add plots to the farm, nor guess IDs", async () => {
const b = serviceFor("b");
expect((await b.listFarms()).items.map(f => f.farmId)).not.toContain(farmA);
await expect(b.farm(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
const before = await db.plot.count({ where: { farmId: farmA } });
await expect(b.createPlot(farmA, { requestId: crypto.randomUUID(), name: "Intruder" })).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(b.farm(crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
expect(await db.plot.count({ where: { farmId: farmA } })).toBe(before);
});
it("profile updates cannot be redirected to another farmer by forged identifiers", async () => {
const farmerA = await db.farmer.findUniqueOrThrow({ where: { userId: users.a } });
await expect(serviceFor("b").updateProfile({ ...profile("Hijack"), expectedVersion: 1, farmerId: farmerA.id })).rejects.toMatchObject({ code: "INVALID_INPUT" });
await expect(serviceFor("b").createFarm({ ...farmInput("Hijack"), tenantId: tenantA })).rejects.toMatchObject({ code: "INVALID_INPUT" });
expect((await serviceFor("a").currentFarmer())?.name).toBe("Farmer A");
expect(await db.farm.count({ where: { name: "Hijack" } })).toBe(0);
});
it("an administrator of the tenant has no automatic farm-data access", async () => {
const admin = serviceFor("admin");
expect(await admin.currentFarmer()).toBeNull();
await expect(admin.farm(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(admin.listFarms()).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("revoked tenant membership blocks the next request", async () => {
const key = { userId_organizationId: { userId: users.a, organizationId: tenantA } };
await db.membership.update({ where: key, data: { status: "REVOKED" } });
try {
await expect(serviceFor("a").farm(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(serviceFor("a").createFarm(farmInput("After revoke"))).rejects.toMatchObject({ code: "FORBIDDEN" });
} finally { await db.membership.update({ where: key, data: { status: "ACTIVE" } }); }
});
it("revoked farm membership hides the farm", async () => {
const key = { farmId_userId: { farmId: farmA, userId: users.a } };
await db.farmMember.update({ where: key, data: { status: "REVOKED" } });
try {
await expect(serviceFor("a").farm(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
expect((await serviceFor("a").listFarms()).items.map(f => f.farmId)).not.toContain(farmA);
} finally { await db.farmMember.update({ where: key, data: { status: "ACTIVE" } }); }
});
it("another farmer cannot obtain a private file grant in the farmer's scope", async () => {
const signedRead = async () => "https://signed.invalid/object";
const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects.b }) }, identityRepository(db));
const requestId = crypto.randomUUID();
await expect(new PrivateFileService(auth, { signedRead }, auditService(db)).read(tenantA, crypto.randomUUID(), requestId)).rejects.toMatchObject({ code: "FORBIDDEN" });
expect(await db.auditEvent.count({ where: { requestId } })).toBe(0);
});
});

describe("idempotency, concurrency and versioning", () => {
it("a replayed farm request returns the same farm without duplicating", async () => {
const input = farmInput("Replay farm");
const first = await serviceFor("a").createFarm(input);
expect(await serviceFor("a").createFarm(input)).toEqual(first);
const concurrent = farmInput("Concurrent farm");
const results = await Promise.all([serviceFor("a").createFarm(concurrent), serviceFor("a").createFarm(concurrent), serviceFor("a").createFarm(concurrent)]);
expect(new Set(results.map(r => r.farmId)).size).toBe(1);
expect(await db.farm.count({ where: { tenantId: tenantA, name: { in: ["Replay farm", "Concurrent farm"] } } })).toBe(2);
expect(await db.farmMember.count({ where: { farmId: results[0].farmId } })).toBe(1);
});
it("a replayed plot request does not duplicate; duplicate names conflict", async () => {
const input = { requestId: crypto.randomUUID(), name: "Plot R" };
const first = await serviceFor("a").createPlot(farmA, input);
expect(await serviceFor("a").createPlot(farmA, input)).toEqual(first);
await expect(serviceFor("a").createPlot(farmA, { requestId: crypto.randomUUID(), name: "Plot R" })).rejects.toMatchObject({ code: "CONFLICT" });
expect(await db.plot.count({ where: { farmId: farmA, name: "Plot R" } })).toBe(1);
});
it("a request ID reused by another farmer cannot replay their record", async () => {
const input = farmInput("Shared request");
await serviceFor("a").createFarm(input);
const forB = await serviceFor("b").createFarm(input);
expect((await db.farm.findUniqueOrThrow({ where: { id: forB.farmId } })).tenantId).toBe(tenantB);
});
it("profile updates use optimistic versions and replay safely", async () => {
const a = serviceFor("a");
const update = { ...profile("Farmer A"), village: "Kebisoni", expectedVersion: 1 };
const updated = await a.updateProfile(update);
expect(updated).toMatchObject({ version: 2, village: "Kebisoni" });
expect(await a.updateProfile(update)).toMatchObject({ version: 2 });
await expect(a.updateProfile({ ...profile("Stale"), expectedVersion: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
expect(await a.currentFarmer()).toMatchObject({ name: "Farmer A", version: 2 });
expect(await db.auditEvent.count({ where: { requestId: update.requestId, action: "FARMER_PROFILE_UPDATED" } })).toBe(1);
});
it("writes are audited with actor, tenant and target", async () => {
const audit = await db.auditEvent.findMany({ where: { actorId: users.a, action: { in: ["FARMER_REGISTERED", "FARM_CREATED", "PLOT_CREATED"] } } });
expect(audit.every(e => e.tenantId === tenantA && e.targetId)).toBe(true);
expect(new Set(audit.map(e => e.action))).toEqual(new Set(["FARMER_REGISTERED", "FARM_CREATED", "PLOT_CREATED"]));
});
});

describe("database constraints and row security (AC003)", () => {
const farmRow = () => ({ id: crypto.randomUUID(), tenantId: tenantA, name: "Check", district: "R", ownershipType: "OWNED" as const, primaryActivity: "CROPS" as const, createdBy: users.a });
it("rejects negative acreage, half or out-of-range coordinates", async () => {
const ownerFarmerId = (await db.farmer.findUniqueOrThrow({ where: { userId: users.a } })).id;
await expect(db.farm.create({ data: { ...farmRow(), ownerFarmerId, approximateAcreage: "-1" } })).rejects.toThrow();
await expect(db.farm.create({ data: { ...farmRow(), ownerFarmerId, latitude: "1" } })).rejects.toThrow();
await expect(db.farm.create({ data: { ...farmRow(), ownerFarmerId, latitude: "91", longitude: "0" } })).rejects.toThrow();
await expect(db.plot.create({ data: { id: crypto.randomUUID(), tenantId: tenantA, farmId: farmA, name: "Neg", area: "-1", areaUnit: "ACRE", createdBy: users.a } })).rejects.toThrow();
await expect(db.plot.create({ data: { id: crypto.randomUUID(), tenantId: tenantA, farmId: farmA, name: "Half", area: "1", createdBy: users.a } })).rejects.toThrow();
expect(await db.farm.count({ where: { name: "Check" } })).toBe(0);
});
it("RLS is enabled on every registry table and browser roles read nothing", async () => {
const rows = await db.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('Farmer', 'FarmerProfile', 'Farm', 'Plot', 'FarmMember') ORDER BY relname`;
expect(rows).toHaveLength(5); expect(rows.every(r => r.relrowsecurity)).toBe(true);
await db.$executeRawUnsafe("CREATE ROLE myfarm_phase02_browser NOLOGIN").catch(() => {});
await db.$executeRawUnsafe('GRANT SELECT ON "Farmer", "FarmerProfile", "Farm", "Plot", "FarmMember" TO myfarm_phase02_browser');
await db.$transaction(async tx => {
await tx.$executeRawUnsafe("SET LOCAL ROLE myfarm_phase02_browser");
const counts = await tx.$queryRaw<{ n: bigint }[]>`SELECT (SELECT COUNT(*) FROM "Farm") + (SELECT COUNT(*) FROM "FarmerProfile") + (SELECT COUNT(*) FROM "Plot") AS n`;
expect(counts[0].n).toBe(0n);
});
});
});
