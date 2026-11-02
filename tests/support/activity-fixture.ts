import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ActivityService } from "@/modules/farm-activities/application/activity";
import { activityRepository } from "@/modules/farm-activities/infrastructure/activity-repository";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "./provisioning";

const FIXTURE_TABLES = ["ProductionActivity", "AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "Enterprise", "Plot", "FarmMember", "Farm", "AuditEvent"];

export async function activityFixture() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Activity tests require isolated loopback database.");
  const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
  const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  const tenants: string[] = [], users: string[] = [];
  async function member(label: string) {
    const subject = crypto.randomUUID();
    const user = await owner.user.create({ data: { authSubject: subject } });
    const org = await owner.organization.create({ data: { name: label, kind: "PERSONAL" } });
    tenants.push(org.id); users.push(user.id);
    await owner.membership.create({ data: { userId: user.id, organizationId: org.id, role: "FARMER" } });
    const farmer = await owner.farmer.create({ data: { id: crypto.randomUUID(), userId: user.id, tenantId: org.id } });
    const farm = await owner.farm.create({ data: { id: crypto.randomUUID(), tenantId: org.id, ownerFarmerId: farmer.id, name: label, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS", createdBy: user.id } });
    await owner.farmMember.create({ data: { userId: user.id, farmId: farm.id, tenantId: org.id, role: "OWNER" } });
    const scope = { actorId: user.id, tenantId: org.id, farmId: farm.id };
    const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(runtime));
    const parent = { tenantId: org.id, farmId: farm.id, createdBy: user.id };
    const crop = await owner.enterprise.create({ data: { ...parent, name: "Maize", type: "CROP" } });
    const poultry = await owner.enterprise.create({ data: { ...parent, name: "Layers", type: "POULTRY" } });
    const fish = await owner.enterprise.create({ data: { ...parent, name: "Tilapia", type: "FISH" } });
    const plot = await owner.plot.create({ data: { id: crypto.randomUUID(), ...parent, name: "Plot B" } });
    return { scope, auth, crop, poultry, fish, plot, activities: new ActivityService(auth, registryRepository(runtime), activityRepository(runtime)) };
  }
  const a = await member("Activity farm A");
  const b = await member("Activity farm B");
  const command = (overrides: Record<string, unknown> = {}) => ({ requestId: crypto.randomUUID(), type: "FERTILIZING", dueOn: "2026-11-03", enterpriseId: a.crop.id, plotId: a.plot.id, ...overrides });
  return { owner, runtime, a, b, command, async cleanup() {
    // Only these fixture tenants on the explicit isolated database; reverse dependency order.
    for (const table of FIXTURE_TABLES) await owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = ANY($1::uuid[])', tenants);
    await owner.farmer.deleteMany({ where: { userId: { in: users } } });
    await owner.membership.deleteMany({ where: { userId: { in: users } } });
    await owner.organization.deleteMany({ where: { id: { in: tenants } } });
    await owner.user.deleteMany({ where: { id: { in: users } } });
    await runtime.$disconnect(); await owner.$disconnect();
  } };
}
