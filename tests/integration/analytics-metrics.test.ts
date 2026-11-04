import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { farmReportRepository } from "@/modules/farm-accounting/infrastructure/report-repository";
import { PoultryProductionService } from "@/modules/harvest-inventory/application/production";
import { poultryProductionRepository } from "@/modules/harvest-inventory/infrastructure/production-repository";
import { StockService } from "@/modules/harvest-inventory/application/stock";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
import { FarmProfitabilityService } from "@/modules/analytics-profitability/application/profitability";
import { metricFactsRepository } from "@/modules/analytics-profitability/infrastructure/metric-facts-repository";
import { dashboardSeasonRepository } from "@/modules/analytics-profitability/infrastructure/repository";

const id = () => crypto.randomUUID();
const seed = { labour: "f4040002-0000-4000-8000-000000000109", feed: "f4040002-0000-4000-8000-000000000112", fertilizer: "f4040002-0000-4000-8000-000000000111", rent: "f4040002-0000-4000-8000-000000000105", cropSales: "f4040002-0000-4000-8000-000000000204", eggSales: "f4040002-0000-4000-8000-000000000202", birdSales: "f4040002-0000-4000-8000-000000000203", otherIncome: "f4040002-0000-4000-8000-000000000201" };
const value = (text: string) => ({ status: "AVAILABLE", value: text });
const notAvailable = (reason: string) => ({ status: "UNAVAILABLE", reason });
const now = new Date("2027-12-31T09:00:00.000Z");
let f: Awaited<ReturnType<typeof inventoryFixture>>, accounts: FarmAccountingService, stock: StockService, flock: PoultryProductionService, dashboards: FarmProfitabilityService;
let farm: string, season: string, maize: string, poultry: string, batch: string, otherBatch: string, foreignFarmBatch: string, foreignTenantBatch: string, foreignTenant: string, foreignUser: string, otherPoultry: string;
const spend = (data: Record<string, unknown>, kind: "EXPENSE" | "PURCHASE" = "EXPENSE") => accounts.recordTransaction(kind, farm, { requestId: id(), categoryId: seed.feed, amount: "1000", currency: "UGX", occurredOn: "2027-03-10", ...data });
const crop = async (input: Record<string, unknown> = {}) => (await dashboards.metrics(farm, input)).crops.find(line => line.enterpriseId === maize)!;
const birds = async (input: Record<string, unknown> = {}, batchId = batch) => (await dashboards.metrics(farm, input)).batches.find(line => line.batchId === batchId)!;
const reason = "Entered by mistake";
const reverse = (targetType: string, targetId: string) => stock.reverse(farm, { requestId: id(), targetType, targetId, reason, occurredOn: "2027-11-01", confirmed: true });
const flockEvent = (type: string, quantity: string, unit: string, extra: Record<string, unknown> = {}, batchId = batch) => flock.record(farm, { requestId: id(), batchId, locationId: f.location.storageLocationId, type, quantity, unit, occurredOn: "2027-04-01", ...extra });

async function poultryBatch(enterpriseId: string, label: string, startingQuantity: number, scope = { tenantId: f.scope.tenantId, farmId: farm }, createdBy = f.scope.actorId) {
  const animal = await f.owner.animalTypeCatalog.findFirstOrThrow();
  return (await f.owner.poultryBatch.create({ data: { ...scope, enterpriseId, animalTypeId: animal.id, animalTypeName: animal.name, batchLabel: label, batchLabelKey: label.toLowerCase(), startingQuantity, acquisitionDate: new Date("2027-03-01Z"), purpose: "DUAL_PURPOSE", createdBy } })).id;
}

beforeAll(async () => {
  f = await inventoryFixture();
  farm = f.scope.farmId; season = f.cycle.seasonId; maize = f.cycle.enterpriseId;
  const registry = registryRepository(f.runtime);
  accounts = new FarmAccountingService(f.auth, registry, farmAccountingRepository(f.runtime));
  stock = new StockService(f.auth, registry, stockRepository(f.runtime));
  flock = new PoultryProductionService(f.auth, registry, poultryProductionRepository(f.runtime));
  dashboards = new FarmProfitabilityService(f.auth, registry, farmReportRepository(f.runtime), dashboardSeasonRepository(f.runtime), metricFactsRepository(f.runtime), () => now);
  await f.owner.cropCycle.update({ where: { id: f.cycle.id }, data: { areaPlanted: "3" } });
  const where = { tenantId: f.scope.tenantId, farmId: farm, createdBy: f.scope.actorId };
  poultry = (await f.owner.enterprise.create({ data: { ...where, name: "Layers", type: "POULTRY" } })).id;
  otherPoultry = (await f.owner.enterprise.create({ data: { ...where, name: "Broilers", type: "POULTRY" } })).id;
  batch = await poultryBatch(poultry, "Batch 1", 100);
  otherBatch = await poultryBatch(otherPoultry, "Batch 2", 50);
  const owner = await f.owner.farmer.findFirstOrThrow({ where: { tenantId: f.scope.tenantId } });
  const secondFarm = await f.owner.farm.create({ data: { id: id(), tenantId: f.scope.tenantId, ownerFarmerId: owner.id, name: "Second farm", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS", createdBy: f.scope.actorId } });
  const secondEnterprise = await f.owner.enterprise.create({ data: { tenantId: f.scope.tenantId, farmId: secondFarm.id, createdBy: f.scope.actorId, name: "Elsewhere", type: "POULTRY" } });
  foreignFarmBatch = await poultryBatch(secondEnterprise.id, "Elsewhere", 10, { tenantId: f.scope.tenantId, farmId: secondFarm.id });
  const user = await f.owner.user.create({ data: { authSubject: id() } }); foreignUser = user.id;
  const org = await f.owner.organization.create({ data: { name: "Another tenant", kind: "PERSONAL" } }); foreignTenant = org.id;
  const farmer = await f.owner.farmer.create({ data: { id: id(), userId: user.id, tenantId: org.id } });
  const other = await f.owner.farm.create({ data: { id: id(), tenantId: org.id, ownerFarmerId: farmer.id, name: "Another", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS", createdBy: user.id } });
  const otherEnterprise = await f.owner.enterprise.create({ data: { tenantId: org.id, farmId: other.id, createdBy: user.id, name: "Theirs", type: "POULTRY" } });
  foreignTenantBatch = await poultryBatch(otherEnterprise.id, "Theirs", 10, { tenantId: org.id, farmId: other.id }, user.id);

  // The approved crop example: 2,100,000 UGX, 3 acres, 4,000 kg gross, 250 kg lost.
  await spend({ categoryId: seed.fertilizer, amount: "2100000", enterpriseId: maize, seasonId: season });
  await f.harvest.record(farm, { ...f.command(), quantity: "4000", lossQuantity: "250", harvestDate: "2027-07-01" });
  // The approved bird example: 100 started, 5 bought, 3 died, 525,000 UGX of costs.
  await flockEvent("PURCHASE", "5", "BIRD");
  await flockEvent("MORTALITY", "3", "BIRD");
  await spend({ amount: "525000", batchId: batch });
}, 60_000);
afterAll(async () => {
  try {
    for (const tenantId of [foreignTenant].filter(Boolean)) {
      await f.owner.poultryBatch.deleteMany({ where: { tenantId } }); await f.owner.enterprise.deleteMany({ where: { tenantId } }); await f.owner.farm.deleteMany({ where: { tenantId } }); await f.owner.farmer.deleteMany({ where: { tenantId } }); await f.owner.organization.delete({ where: { id: tenantId } });
    }
    if (foreignUser) await f.owner.user.delete({ where: { id: foreignUser } });
    await f.owner.farmMember.deleteMany({ where: { tenantId: f.scope.tenantId } });
    await f.owner.auditEvent.deleteMany({ where: { actorId: f.scope.actorId } });
    await f.owner.$executeRawUnsafe('DELETE FROM "StockMovement" WHERE "tenantId" = $1::uuid', f.scope.tenantId);
    await f.owner.stockOperation.deleteMany({ where: { tenantId: f.scope.tenantId } });
    await f.owner.productionEvent.deleteMany({ where: { tenantId: f.scope.tenantId } });
  } finally { await f.cleanup(); }
});

describe("MYF-P08-AC002 approved figures from real records under the restricted role (P08-T005)", () => {
  it("reproduces the crop example", async () => {
    const line = await crop();
    expect(line).toMatchObject({ enterpriseName: "Maize", crops: ["Maize"], soFar: true, acres: value("3"), harvestedKg: "4000", keptKg: "3750", yieldPerAcre: value("1333.33") });
    expect(line.currencies).toEqual([{ currency: "UGX", costs: "2100000", revenue: "0", costPerAcre: value("700000"), revenuePerAcre: value("0"), costPerKg: value("560") }]);
  });
  it("reproduces the bird example", async () => {
    const line = await birds();
    expect(line).toMatchObject({ label: "Batch 1", soFar: true, birdsStarted: "105", deaths: "3", mortalityRate: value("2.9") });
    expect(line.currencies[0]).toMatchObject({ currency: "UGX", costs: "525000", costPerBird: value("5000") });
  });
  it("a later recorded loss lowers the kg kept, and reversing it restores them", async () => {
    const before = await f.owner.harvest.findFirstOrThrow({ where: { cropCycleId: f.cycle.id } });
    const loss = await stock.post(farm, { requestId: id(), itemId: before.itemId, locationId: f.location.storageLocationId, type: "LOSS", quantity: "150", unit: "KG", occurredOn: "2027-08-01", reason });
    expect(await crop()).toMatchObject({ keptKg: "3600", yieldPerAcre: value("1333.33") });
    expect((await crop()).currencies[0].costPerKg).toEqual(value("583.33"));
    await reverse("OPERATION", loss.operationId);
    expect(await crop()).toMatchObject({ keptKg: "3750" });
  });
  it("a reversed harvest leaves the figures", async () => {
    const extra = await f.harvest.record(farm, { ...f.command(), quantity: "1000", lossQuantity: "100", harvestDate: "2027-07-02" });
    expect(await crop()).toMatchObject({ harvestedKg: "5000", keptKg: "4650" });
    await reverse("HARVEST", extra.harvestId);
    expect(await crop()).toMatchObject({ harvestedKg: "4000", keptKg: "3750" });
  });
  it("a reversed death or purchase leaves the flock figures", async () => {
    const death = await flockEvent("MORTALITY", "2", "BIRD");
    expect(await birds()).toMatchObject({ deaths: "5", mortalityRate: value("4.8") });
    await reverse("PRODUCTION", death.eventId);
    expect(await birds()).toMatchObject({ deaths: "3", mortalityRate: value("2.9") });
    const bought = await flockEvent("PURCHASE", "20", "BIRD");
    expect((await birds()).birdsStarted).toBe("125");
    await reverse("PRODUCTION", bought.eventId);
    expect((await birds()).birdsStarted).toBe("105");
  });
  it("revenue per bird counts bird and egg sales of that batch only, whichever view is shown", async () => {
    const sale = await flockEvent("BIRD_SALE", "1", "BIRD", { sale: { categoryId: seed.birdSales, amount: "21000", currency: "UGX" } });
    const laid = await flockEvent("EGGS", "30", "EGG");
    expect(laid.eventId).toBeTruthy();
    const eggs = await f.owner.inventoryItem.findFirstOrThrow({ where: { batchId: batch, kind: "EGG" } });
    const eggSale = await stock.post(farm, { requestId: id(), itemId: eggs.id, locationId: f.location.storageLocationId, type: "SALE", quantity: "10", unit: "EGG", occurredOn: "2027-04-02", reason: "Sold", sale: { categoryId: seed.eggSales, amount: "10500", currency: "UGX" } });
    for (const input of [{}, { seasonId: "all" }, { from: "2020-01-01", to: "2020-01-02" }]) {
      expect((await birds(input)).currencies[0]).toMatchObject({ revenue: "31500", revenuePerBird: value("300") });
      expect((await birds(input, otherBatch)).currencies.filter(row => row.revenue !== "0")).toEqual([]);
    }
    await reverse("OPERATION", eggSale.operationId);
    await reverse("PRODUCTION", sale.eventId);
    expect((await birds()).currencies[0]).toMatchObject({ revenue: "0", revenuePerBird: value("0") });
  });
  it("names the enterprise's costs linked to no batch beside its batch", async () => {
    await spend({ amount: "40000", enterpriseId: otherPoultry });
    expect((await birds({}, otherBatch)).currencies[0]).toMatchObject({ costs: "0", enterpriseCostsNotLinked: "40000" });
  });
  it("follows the view: a season and all records, with dates saying they cannot be used", async () => {
    const elsewhere = await f.owner.season.create({ data: { tenantId: f.scope.tenantId, farmId: farm, label: "Other", startDate: new Date("2020-03-01Z"), createdBy: f.scope.actorId } });
    const plot = await f.owner.plot.findFirstOrThrow({ where: { farmId: farm } });
    const second = await f.owner.cropCycle.create({ data: { tenantId: f.scope.tenantId, farmId: farm, enterpriseId: maize, seasonId: elsewhere.id, plotId: plot.id, cropId: f.cycle.cropId, cropName: "Maize", areaPlanted: "2", areaUnit: "ACRE", plantingDate: new Date("2020-03-02Z"), status: "CLOSED", createdBy: f.scope.actorId } });
    try {
      expect((await crop({ seasonId: season })).acres).toEqual(value("3"));
      expect((await crop({ seasonId: elsewhere.id })).acres).toEqual(value("2"));
      expect((await crop({ seasonId: elsewhere.id })).soFar).toBe(false);
      expect((await crop({ seasonId: "all" })).acres).toEqual(value("5"));
      const dated = await crop({ from: "2027-01-01" });
      expect(dated.yieldPerAcre).toEqual(notAvailable("DATE_RANGE"));
      expect(dated.currencies[0].costPerKg).toEqual(notAvailable("DATE_RANGE"));
    } finally { await f.owner.cropCycle.delete({ where: { id: second.id } }); await f.owner.season.delete({ where: { id: elsewhere.id } }); }
  });
  it("a second crop in the enterprise makes per-acre and per-kg figures say why", async () => {
    const other = await f.owner.cropCatalog.findFirstOrThrow({ where: { NOT: { id: f.cycle.cropId } } });
    const plot = await f.owner.plot.findFirstOrThrow({ where: { farmId: farm } });
    const second = await f.owner.cropCycle.create({ data: { tenantId: f.scope.tenantId, farmId: farm, enterpriseId: maize, seasonId: season, plotId: plot.id, cropId: other.id, cropName: other.name, areaPlanted: "1", areaUnit: "ACRE", plantingDate: new Date("2027-03-02Z"), createdBy: f.scope.actorId } });
    try {
      const line = await crop();
      expect(line.crops).toHaveLength(2);
      expect(line.yieldPerAcre).toEqual(notAvailable("MORE_THAN_ONE_CROP"));
      expect(line.currencies[0]).toMatchObject({ costs: "2100000", costPerKg: notAvailable("MORE_THAN_ONE_CROP") });
    } finally { await f.owner.cropCycle.delete({ where: { id: second.id } }); }
  });
  it("cost groups come from the stored data and add up to all costs", async () => {
    const before = (await dashboards.metrics(farm, { seasonId: "all" })).costGroups[0];
    await spend({ categoryId: seed.labour, amount: "7000" });
    await spend({ categoryId: seed.rent, amount: "11" });
    const after = (await dashboards.metrics(farm, { seasonId: "all" })).costGroups[0];
    expect(BigInt(after.labour) - BigInt(before.labour)).toBe(7000n);
    expect(BigInt(after.other) - BigInt(before.other)).toBe(11n);
    expect(after.inputs).toBe(before.inputs);
    const total = (await dashboards.dashboard(farm, { seasonId: "all" })).currencies[0].expenses;
    expect(BigInt(after.labour) + BigInt(after.inputs) + BigInt(after.other)).toBe(BigInt(total));
  });
  it("the cash view counts only money that moved", async () => {
    const owed = await spend({ categoryId: seed.feed, amount: "999", batchId: otherBatch }, "PURCHASE");
    expect((await birds({}, otherBatch)).currencies[0].costs).toBe("999");
    expect((await birds({ basis: "CASH" }, otherBatch)).currencies[0].costs).toBe("0");
    await accounts.reverse(farm, { requestId: id(), recordType: "PURCHASE", recordId: owed.recordId, reason });
    expect((await birds({}, otherBatch)).currencies[0].costs).toBe("0");
  });
});

describe("stock value (D-P08-004)", () => {
  it("uses the latest sale that stands, stays out of the surplus, and says when an item was never sold", async () => {
    const harvest = await f.owner.harvest.findFirstOrThrow({ where: { cropCycleId: f.cycle.id } });
    const line = async () => (await dashboards.metrics(farm)).stock.items.find(row => row.itemId === harvest.itemId)!;
    expect(await line()).toMatchObject({ quantity: "3750", estimate: notAvailable("NEVER_SOLD"), soldOn: null });
    const surplus = async () => (await dashboards.dashboard(farm, { seasonId: "all" })).currencies[0].recordedSurplus;
    const sell = (quantity: string, amount: string, occurredOn: string) => stock.post(farm, { requestId: id(), itemId: harvest.itemId, locationId: f.location.storageLocationId, type: "SALE", quantity, unit: "KG", occurredOn, reason: "Sold", sale: { categoryId: seed.cropSales, amount, currency: "UGX" } });
    await sell("100", "120000", "2027-08-01");
    expect(await line()).toMatchObject({ quantity: "3650", pricePerUnit: value("1200"), estimate: value("4380000"), currency: "UGX", soldOn: "2027-08-01" });
    const before = await surplus();
    const later = await sell("50", "75000", "2027-09-01");
    expect(await line()).toMatchObject({ quantity: "3600", pricePerUnit: value("1500"), estimate: value("5400000"), soldOn: "2027-09-01" });
    expect(BigInt(await surplus()) - BigInt(before)).toBe(75000n);
    await reverse("OPERATION", later.operationId);
    expect(await line()).toMatchObject({ quantity: "3650", pricePerUnit: value("1200"), soldOn: "2027-08-01" });
    expect((await crop()).currencies[0]).toMatchObject({ revenue: "120000", revenuePerAcre: value("40000") });
  });
});

describe("the batch link (D-P08-003)", () => {
  it("a cost on a batch lands in that batch's enterprise, and a retry replays it once", async () => {
    const command = { requestId: id(), categoryId: seed.feed, amount: "1234", currency: "UGX", occurredOn: "2027-03-11", batchId: batch };
    const saved = await accounts.recordTransaction("EXPENSE", farm, command);
    expect(saved).toMatchObject({ batchId: batch, batchLabel: "Batch 1", enterpriseId: poultry });
    expect(await accounts.recordTransaction("EXPENSE", farm, command)).toEqual(saved);
    expect(await f.owner.accountingRecord.count({ where: { id: saved.recordId } })).toBe(1);
    await expect(accounts.recordTransaction("EXPENSE", farm, { ...command, batchId: otherBatch })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(accounts.recordTransaction("EXPENSE", farm, { ...command, batchId: undefined })).rejects.toMatchObject({ code: "CONFLICT" });
    await accounts.reverse(farm, { requestId: id(), recordType: "EXPENSE", recordId: saved.recordId, reason });
  });
  it("a purchase may name a batch and its own enterprise; another enterprise is refused", async () => {
    const saved = await spend({ batchId: batch, enterpriseId: poultry, amount: "5" }, "PURCHASE");
    expect(saved.batchId).toBe(batch);
    await accounts.reverse(farm, { requestId: id(), recordType: "PURCHASE", recordId: saved.recordId, reason });
    await expect(spend({ batchId: batch, enterpriseId: otherPoultry })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("a batch of another farm or tenant, or a guess, looks the same and creates nothing", async () => {
    const before = await f.owner.accountingRecord.count({ where: { farmId: farm } });
    for (const batchId of [foreignFarmBatch, foreignTenantBatch, id()]) await expect(spend({ batchId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await f.owner.accountingRecord.count({ where: { farmId: farm } })).toBe(before);
  });
  it("income and sales cannot name a batch", async () => {
    await expect(accounts.recordTransaction("INCOME", farm, { requestId: id(), categoryId: seed.otherIncome, amount: "1", currency: "UGX", occurredOn: "2027-03-11", batchId: batch })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(accounts.recordTransaction("SALE", farm, { requestId: id(), categoryId: seed.cropSales, amount: "1", currency: "UGX", occurredOn: "2027-03-11", batchId: batch })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("the database itself refuses a forged link from the runtime role", async () => {
    const row = (kind: "EXPENSE" | "INCOME", categoryId: string, categoryName: string, enterpriseId: string | null, batchId: string) => f.runtime.accountingRecord.create({ data: { id: id(), tenantId: f.scope.tenantId, farmId: farm, kind, categoryId, categoryName, amount: "1", currency: "UGX", occurredOn: new Date("2027-03-11Z"), enterpriseId, batchId, createdBy: f.scope.actorId } });
    await expect(row("EXPENSE", seed.feed, "Feed", otherPoultry, batch)).rejects.toThrow();
    await expect(row("EXPENSE", seed.feed, "Feed", null, batch)).rejects.toThrow();
    await expect(row("INCOME", seed.otherIncome, "Other income", poultry, batch)).rejects.toThrow();
    await expect(row("EXPENSE", seed.feed, "Feed", poultry, foreignFarmBatch)).rejects.toThrow();
    await expect(f.owner.accountingRecord.create({ data: { id: id(), tenantId: f.scope.tenantId, farmId: farm, kind: "EXPENSE", categoryId: seed.feed, categoryName: "Feed", amount: "1", currency: "UGX", occurredOn: new Date("2027-03-11Z"), batchId: foreignFarmBatch, createdBy: f.scope.actorId } })).rejects.toThrow();
  });
});

describe("metrics access (P08-T005)", () => {
  it("another tenant's farm and season are denied, and forged scope is refused", async () => {
    await expect(dashboards.metrics(id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dashboards.metrics(farm, { seasonId: id() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dashboards.metrics(farm, { tenantId: foreignTenant })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("a batch of another farm never appears", async () => {
    const seen = (await dashboards.metrics(farm)).batches.map(row => row.batchId);
    expect(seen).toContain(batch);
    expect(seen).not.toContain(foreignFarmBatch);
    expect(seen).not.toContain(foreignTenantBatch);
  });
  it("reading writes nothing", async () => {
    const before = await f.owner.auditEvent.count();
    expect(await dashboards.metrics(farm)).toEqual(await dashboards.metrics(farm));
    expect(await f.owner.auditEvent.count()).toBe(before);
  });
});
