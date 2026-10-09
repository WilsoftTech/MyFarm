import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Integration requires isolated local myfarm_phase01_test database.");
// Owner connection provisions fixtures; the runtime connection has exactly the hosted server role's privileges.
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5, options: "-c role=myfarm_runtime" }) });

const users = { a: crypto.randomUUID(), b: crypto.randomUUID() };
const subjects = { a: crypto.randomUUID(), b: crypto.randomUUID() };
const serviceFor = (who: keyof typeof users) => new FarmerRegistryService(new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime)), registryRepository(runtime));
const profile = (name: string) => ({ requestId: crypto.randomUUID(), name, phone: "0772 123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] });
const farmInput = (name: string) => ({ requestId: crypto.randomUUID(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "POULTRY" });
const denied = /permission denied|row-level security/i;
let tenantA: string, farmerA: string, farmA: string, tenantB: string;

beforeAll(async () => {
await owner.$executeRawUnsafe(`DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'myfarm_runtime') THEN CREATE ROLE myfarm_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; END IF;
END $$`);
// Foundation subset of supabase/policies/runtime-role.sql (its session-check function needs Supabase's auth schema).
for (const statement of [
"GRANT USAGE ON SCHEMA public TO myfarm_runtime",
'GRANT SELECT ON TABLE "User", "Organization", "Membership", "AuditEvent" TO myfarm_runtime',
'GRANT INSERT ON TABLE "AuditEvent" TO myfarm_runtime',
'DROP POLICY IF EXISTS myfarm_server_user_read ON "User"', 'CREATE POLICY myfarm_server_user_read ON "User" FOR SELECT TO myfarm_runtime USING (true)',
'DROP POLICY IF EXISTS myfarm_server_organization_read ON "Organization"', 'CREATE POLICY myfarm_server_organization_read ON "Organization" FOR SELECT TO myfarm_runtime USING (true)',
'DROP POLICY IF EXISTS myfarm_server_membership_read ON "Membership"', 'CREATE POLICY myfarm_server_membership_read ON "Membership" FOR SELECT TO myfarm_runtime USING (true)',
'DROP POLICY IF EXISTS myfarm_server_audit_read ON "AuditEvent"', 'CREATE POLICY myfarm_server_audit_read ON "AuditEvent" FOR SELECT TO myfarm_runtime USING (true)',
'DROP POLICY IF EXISTS myfarm_server_audit_append ON "AuditEvent"', 'CREATE POLICY myfarm_server_audit_append ON "AuditEvent" FOR INSERT TO myfarm_runtime WITH CHECK (true)',
]) await owner.$executeRawUnsafe(statement);
// The Phase2 provider file is applied verbatim, exactly as on the hosted project.
await owner.$executeRawUnsafe(readFileSync("supabase/policies/farmer-registry-runtime.sql", "utf8"));
await owner.user.createMany({ data: [{ id: users.a, authSubject: subjects.a }, { id: users.b, authSubject: subjects.b }] });
});
afterAll(async () => {
const ids = Object.values(users);
const tenants = (await owner.membership.findMany({ where: { userId: { in: ids } }, select: { organizationId: true } })).map(m => m.organizationId);
await owner.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
await owner.plot.deleteMany({ where: { tenantId: { in: tenants } } });
await owner.farmMember.deleteMany({ where: { tenantId: { in: tenants } } });
await owner.farm.deleteMany({ where: { tenantId: { in: tenants } } });
await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: ids } } } });
await owner.farmer.deleteMany({ where: { userId: { in: ids } } });
await owner.membership.deleteMany({ where: { userId: { in: ids } } });
await owner.organization.deleteMany({ where: { id: { in: tenants } } });
await owner.user.deleteMany({ where: { id: { in: ids } } });
await Promise.all([owner.$disconnect(), runtime.$disconnect()]);
});

describe("registry under the restricted runtime role", () => {
it("completes register → farm → plots → profile update → view with runtime privileges only", async () => {
const [{ role }] = await runtime.$queryRaw<{ role: string }[]>`SELECT current_user AS role`;
expect(role).toBe("myfarm_runtime");
const a = serviceFor("a");
const registration = profile("Runtime A");
const me = await a.register(registration);
expect(await a.register(registration)).toEqual(me); // idempotent retry under the same role
({ tenantId: tenantA, farmerId: farmerA } = me);
farmA = (await a.createFarm({ ...farmInput("Runtime farm"), approximateAcreage: "1.25" })).farmId;
await a.createPlot(farmA, { requestId: crypto.randomUUID(), name: "North", area: "0.5", areaUnit: "ACRE" });
await a.createPlot(farmA, { requestId: crypto.randomUUID(), name: "South" });
expect(await a.updateProfile({ ...profile("Runtime A"), village: "Kebisoni", expectedVersion: 1 })).toMatchObject({ version: 2, village: "Kebisoni" });
expect((await a.farm(farmA)).plots.map(p => p.name)).toEqual(["North", "South"]);
expect((await a.listFarms()).items).toEqual([expect.objectContaining({ farmId: farmA, plotCount: 2 })]);
tenantB = (await serviceFor("b").register(profile("Runtime B"))).tenantId;
await expect(serviceFor("b").farm(farmA)).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("cannot join, escalate or revoke memberships", async () => {
await expect(runtime.membership.create({ data: { userId: users.b, organizationId: tenantA, role: "FARMER" } })).rejects.toThrow(denied);
await expect(runtime.membership.create({ data: { userId: users.b, organizationId: tenantA, role: "ADMIN" } })).rejects.toThrow(denied);
await expect(runtime.organization.create({ data: { name: "Co-op", kind: "ORGANIZATION" } })).rejects.toThrow(denied);
await expect(runtime.membership.updateMany({ where: { userId: users.a }, data: { status: "REVOKED" } })).rejects.toThrow(denied);
expect(await owner.membership.count({ where: { organizationId: tenantA } })).toBe(1);
});

it("cannot write registry rows outside the actor's own farmer and farm scope", async () => {
const id = () => crypto.randomUUID();
// Farm owned by A but created by B, plot on A's farm by B, membership of B on A's farm, B's profile edited as A.
await expect(runtime.farm.create({ data: { id: id(), tenantId: tenantA, ownerFarmerId: farmerA, createdBy: users.b, name: "Forged", district: "R", ownershipType: "OWNED", primaryActivity: "CROPS" } })).rejects.toThrow(denied);
await expect(runtime.plot.create({ data: { id: id(), tenantId: tenantA, farmId: farmA, createdBy: users.b, name: "Forged" } })).rejects.toThrow(denied);
await expect(runtime.farmMember.create({ data: { farmId: farmA, userId: users.b, tenantId: tenantA, role: "OWNER" } })).rejects.toThrow(denied);
const farmerB = await owner.farmer.findUniqueOrThrow({ where: { userId: users.b } });
await expect(runtime.farmerProfile.updateMany({ where: { farmerId: farmerB.id }, data: { name: "Hijack", updatedBy: users.a } })).rejects.toThrow(denied);
expect((await owner.farmerProfile.findUniqueOrThrow({ where: { farmerId: farmerB.id } })).name).toBe("Runtime B");
expect(await owner.plot.count({ where: { name: "Forged" } })).toBe(0);
expect(tenantB).not.toBe(tenantA);
});

it("has no delete, farm/plot update or identifier update privilege", async () => {
await expect(runtime.plot.deleteMany({ where: { farmId: farmA } })).rejects.toThrow(denied);
await expect(runtime.farm.updateMany({ where: { id: farmA }, data: { name: "Renamed" } })).rejects.toThrow(denied);
await expect(runtime.farmerProfile.updateMany({ where: { farmerId: farmerA }, data: { farmerId: crypto.randomUUID() } })).rejects.toThrow(denied);
await expect(runtime.auditEvent.deleteMany({ where: { actorId: users.a } })).rejects.toThrow(denied);
expect(await owner.plot.count({ where: { farmId: farmA } })).toBe(2);
});

it("browser roles have no registry table access", async () => {
for (const role of ["anon", "authenticated"]) {
await expect(owner.$transaction(async tx => {
await tx.$executeRawUnsafe("SET LOCAL ROLE " + role);
await tx.$queryRawUnsafe('SELECT count(*) FROM "Farm"');
})).rejects.toThrow(/permission denied/i);
}
});
});
