import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { HarvestService } from "@/modules/harvest-inventory/application/harvest";
import { harvestRepository } from "@/modules/harvest-inventory/infrastructure/harvest-repository";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "./provisioning";

export async function inventoryFixture() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Inventory tests require isolated loopback database.");
  const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
  const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  const subject = crypto.randomUUID();
  const user = await owner.user.create({ data: { authSubject: subject } });
  const org = await owner.organization.create({ data: { name: "Inventory fixture", kind: "PERSONAL" } });
  await owner.membership.create({ data: { userId: user.id, organizationId: org.id, role: "FARMER" } });
  const farmer = await owner.farmer.create({ data: { id: crypto.randomUUID(), userId: user.id, tenantId: org.id } });
  const farm = await owner.farm.create({ data: { id: crypto.randomUUID(), tenantId: org.id, ownerFarmerId: farmer.id, name: "Inventory farm", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS", createdBy: user.id } });
  await owner.farmMember.create({ data: { userId: user.id, farmId: farm.id, tenantId: org.id, role: "OWNER" } });
  const scope = { actorId: user.id, tenantId: org.id, farmId: farm.id };
  const enterprise = await owner.enterprise.create({ data: { tenantId: org.id, farmId: farm.id, name: "Maize", type: "CROP", createdBy: user.id } });
  const season = await owner.season.create({ data: { tenantId: org.id, farmId: farm.id, label: "2026", startDate: new Date("2026-03-01Z"), createdBy: user.id } });
  const plot = await owner.plot.create({ data: { id: crypto.randomUUID(), tenantId: org.id, farmId: farm.id, name: "Plot", createdBy: user.id } });
  const cycle = await owner.cropCycle.create({ data: { tenantId: org.id, farmId: farm.id, enterpriseId: enterprise.id, seasonId: season.id, plotId: plot.id,
    cropId: "f4030005-0000-4000-8000-000000000001", cropName: "Maize", areaPlanted: "1", areaUnit: "ACRE", plantingDate: new Date("2026-03-01Z"), createdBy: user.id } });
  const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(runtime));
  const harvest = new HarvestService(auth, registryRepository(runtime), harvestRepository(runtime));
  const location = await harvest.createLocation(farm.id, { requestId: crypto.randomUUID(), name: "Main store" });
  const command = () => ({ requestId: crypto.randomUUID(), cropCycleId: cycle.id, cropId: cycle.cropId, plotId: plot.id, storageLocationId: location.storageLocationId,
    harvestDate: "2026-10-01", quantity: "2400", unit: "KG", lossQuantity: "150" });
  return { owner, runtime, auth, harvest, scope, cycle, command, location, async cleanup() {
    // Only this fixture tenant on the explicit isolated database; reverse dependency order.
    for (const table of ["StockMovement", "Harvest", "InventoryItem", "StorageLocation", "AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "CropCycle", "PoultryBatch", "Enterprise", "Season", "Plot", "FarmMember", "Farm", "AuditEvent", "Farmer"]) {
      await owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = $1::uuid', org.id);
    }
    await owner.membership.deleteMany({ where: { userId: user.id } });
    await owner.organization.delete({ where: { id: org.id } }); await owner.user.delete({ where: { id: user.id } });
    await runtime.$disconnect(); await owner.$disconnect();
  } };
}
