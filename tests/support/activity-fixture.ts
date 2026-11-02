import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ActivityService } from "@/modules/farm-activities/application/activity";
import { activityRepository } from "@/modules/farm-activities/infrastructure/activity-repository";
import { RecurrenceService } from "@/modules/farm-activities/application/recurrence";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { HarvestService } from "@/modules/harvest-inventory/application/harvest";
import { harvestRepository } from "@/modules/harvest-inventory/infrastructure/harvest-repository";
import { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import { CropCycleService } from "@/modules/enterprises-seasons/application/crop-cycle";
import { cropCycleRepository } from "@/modules/enterprises-seasons/infrastructure/crop-cycle-repository";
import { ProductionService } from "@/modules/enterprises-seasons/application/production";
import { productionRepository } from "@/modules/enterprises-seasons/infrastructure/repository";
import { recurrenceRepository } from "@/modules/farm-activities/infrastructure/recurrence-repository";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "./provisioning";

const FIXTURE_TABLES = ["RecordPhoto", "ProductionActivity", "ActivityRecurrence", "StockMovement", "Harvest", "InventoryItem", "StorageLocation", "AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "CropCycle", "Enterprise", "Season", "Plot", "FarmMember", "Farm", "AuditEvent"];

export async function activityFixture() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Activity tests require isolated loopback database.");
  const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
  const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  const tenants: string[] = [], users: string[] = [];
  let now = new Date("2026-11-02T09:00:00Z");
  async function member(label: string) {
    const subject = crypto.randomUUID();
    const user = await owner.user.create({ data: { authSubject: subject } });
    const org = await owner.organization.create({ data: { name: label, kind: "PERSONAL" } });
    tenants.push(org.id); users.push(user.id);
    await owner.membership.create({ data: { userId: user.id, organizationId: org.id, role: "FARMER" } });
    const farmer = await owner.farmer.create({ data: { id: crypto.randomUUID(), userId: user.id, tenantId: org.id } });
    await owner.farmerProfile.create({ data: { farmerId: farmer.id, name: label, phone: "+256700000000", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"], updatedBy: user.id } });
    const farm = await owner.farm.create({ data: { id: crypto.randomUUID(), tenantId: org.id, ownerFarmerId: farmer.id, name: label, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS", createdBy: user.id } });
    await owner.farmMember.create({ data: { userId: user.id, farmId: farm.id, tenantId: org.id, role: "OWNER" } });
    const scope = { actorId: user.id, tenantId: org.id, farmId: farm.id };
    const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(runtime));
    const parent = { tenantId: org.id, farmId: farm.id, createdBy: user.id };
    const crop = await owner.enterprise.create({ data: { ...parent, name: "Maize", type: "CROP" } });
    const poultry = await owner.enterprise.create({ data: { ...parent, name: "Layers", type: "POULTRY" } });
    const fish = await owner.enterprise.create({ data: { ...parent, name: "Tilapia", type: "FISH" } });
    const plot = await owner.plot.create({ data: { id: crypto.randomUUID(), ...parent, name: "Plot B" } });
    const registry = registryRepository(runtime);
    const accounting = new FarmAccountingService(auth, registry, farmAccountingRepository(runtime)), harvest = new HarvestService(auth, registry, harvestRepository(runtime));
    const crops = new CropCycleService(auth, registry, cropCycleRepository(runtime)), production = new ProductionService(auth, registry, productionRepository(runtime)), registryService = new FarmerRegistryService(auth, registry);
    return { scope, auth, crop, poultry, fish, plot, accounting, harvest, crops, production, registryService, activities: new ActivityService(auth, registryRepository(runtime), activityRepository(runtime), () => now), recurrences: new RecurrenceService(auth, registryRepository(runtime), recurrenceRepository(runtime), () => now) };
  }
  const a = await member("Activity farm A");
  const b = await member("Activity farm B");
  const command = (overrides: Record<string, unknown> = {}) => ({ requestId: crypto.randomUUID(), type: "FERTILIZING", dueOn: "2026-11-03", enterpriseId: a.crop.id, plotId: a.plot.id, ...overrides });
  return { owner, runtime, a, b, command, setNow(value: string) { now = new Date(value); }, async cleanup() {
    // Only these fixture tenants on the explicit isolated database; reverse dependency order.
    for (const table of FIXTURE_TABLES) await owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = ANY($1::uuid[])', tenants);
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: users } } } });
    await owner.farmer.deleteMany({ where: { userId: { in: users } } });
    await owner.membership.deleteMany({ where: { userId: { in: users } } });
    await owner.organization.deleteMany({ where: { id: { in: tenants } } });
    await owner.user.deleteMany({ where: { id: { in: users } } });
    await runtime.$disconnect(); await owner.$disconnect();
  } };
}
