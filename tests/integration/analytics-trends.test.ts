import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { farmReportRepository } from "@/modules/farm-accounting/infrastructure/report-repository";
import { FarmProfitabilityService } from "@/modules/analytics-profitability/application/profitability";
import { metricFactsRepository } from "@/modules/analytics-profitability/infrastructure/metric-facts-repository";
import { dashboardSeasonRepository } from "@/modules/analytics-profitability/infrastructure/repository";

const id = () => crypto.randomUUID();
const seed = { feed: "f4040002-0000-4000-8000-000000000112", fertilizer: "f4040002-0000-4000-8000-000000000111", veterinary: "f4040002-0000-4000-8000-000000000110" };
const value = (text: string) => ({ status: "AVAILABLE", value: text });
const notAvailable = (reason: string) => ({ status: "UNAVAILABLE", reason });
const now = new Date("2027-12-31T09:00:00.000Z");
const reason = "Entered by mistake";
let f: Awaited<ReturnType<typeof inventoryFixture>>, accounts: FarmAccountingService, service: FarmProfitabilityService;
let farm: string, season: string, earlierSeason: string, maize: string, layers: string, older: string, newer: string, duckBatch: string | null = null, foreignTenant: string, foreignUser: string, foreignSeason: string;
const spend = (data: Record<string, unknown>, kind: "EXPENSE" | "PURCHASE" = "EXPENSE") => accounts.recordTransaction(kind, farm, { requestId: id(), categoryId: seed.feed, amount: "1000", currency: "UGX", occurredOn: "2027-03-10", ...data });
const crop = async (input: Record<string, unknown> = {}) => (await service.trends(farm, input)).crops.find(line => line.cropId === f.cycle.cropId)!;
const bird = async (batchId: string, input: Record<string, unknown> = {}) => (await service.trends(farm, input)).batches.find(line => line.batchId === batchId)!;
const figure = (line: { currencies: { figures: { figure: string }[] }[] }, name: string) => line.currencies[0].figures.find(row => row.figure === name);

async function poultryBatch(label: string, acquired: string, animal: { id: string; name: string }) {
  return (await f.owner.poultryBatch.create({ data: { tenantId: f.scope.tenantId, farmId: farm, enterpriseId: layers, animalTypeId: animal.id, animalTypeName: animal.name, batchLabel: label, batchLabelKey: label.toLowerCase(), startingQuantity: 100, acquisitionDate: new Date(acquired + "Z"), purpose: "DUAL_PURPOSE", status: "CLOSED", createdBy: f.scope.actorId } })).id;
}

beforeAll(async () => {
  f = await inventoryFixture();
  farm = f.scope.farmId; season = f.cycle.seasonId; maize = f.cycle.enterpriseId;
  const registry = registryRepository(f.runtime);
  accounts = new FarmAccountingService(f.auth, registry, farmAccountingRepository(f.runtime));
  service = new FarmProfitabilityService(f.auth, registry, farmReportRepository(f.runtime), dashboardSeasonRepository(f.runtime), metricFactsRepository(f.runtime), () => now);
  const where = { tenantId: f.scope.tenantId, farmId: farm, createdBy: f.scope.actorId };
  // An earlier, closed season that grew the same crop on the same acre.
  earlierSeason = (await f.owner.season.create({ data: { ...where, label: "2025", startDate: new Date("2025-03-01Z"), status: "CLOSED" } })).id;
  const plot = await f.owner.plot.findFirstOrThrow({ where: { farmId: farm } });
  const earlierCycle = await f.owner.cropCycle.create({ data: { ...where, enterpriseId: maize, seasonId: earlierSeason, plotId: plot.id, cropId: f.cycle.cropId, cropName: "Maize", areaPlanted: "1", areaUnit: "ACRE", plantingDate: new Date("2025-03-02Z") } });
  await f.harvest.record(farm, { ...f.command(), cropCycleId: earlierCycle.id, quantity: "2000", lossQuantity: "0", harvestDate: "2025-07-01" });
  await f.owner.cropCycle.update({ where: { id: earlierCycle.id }, data: { status: "CLOSED" } });
  await f.harvest.record(farm, { ...f.command(), quantity: "3000", lossQuantity: "0", harvestDate: "2026-07-01" });
  // The source example, twice: fertilizer for the crop and feed for the batch, 100,000 then 118,000 UGX.
  await spend({ categoryId: seed.fertilizer, amount: "100000", enterpriseId: maize, seasonId: earlierSeason, occurredOn: "2025-04-01" });
  await spend({ categoryId: seed.fertilizer, amount: "118000", enterpriseId: maize, seasonId: season, occurredOn: "2026-04-01" });

  layers = (await f.owner.enterprise.create({ data: { ...where, name: "Layers", type: "POULTRY" } })).id;
  const [chicken, duck] = await f.owner.animalTypeCatalog.findMany({ orderBy: { id: "asc" }, take: 2 });
  older = await poultryBatch("Batch 1", "2027-01-01", chicken);
  newer = await poultryBatch("Batch 2", "2027-06-01", chicken);
  if (duck) duckBatch = await poultryBatch("Ducks", "2027-09-01", duck);
  await spend({ amount: "100000", batchId: older });
  await spend({ amount: "118000", batchId: newer });

  const user = await f.owner.user.create({ data: { authSubject: id() } }); foreignUser = user.id;
  const org = await f.owner.organization.create({ data: { name: "Another tenant", kind: "PERSONAL" } }); foreignTenant = org.id;
  const farmer = await f.owner.farmer.create({ data: { id: id(), userId: user.id, tenantId: org.id } });
  const other = await f.owner.farm.create({ data: { id: id(), tenantId: org.id, ownerFarmerId: farmer.id, name: "Another", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS", createdBy: user.id } });
  foreignSeason = (await f.owner.season.create({ data: { tenantId: org.id, farmId: other.id, label: "Theirs", startDate: new Date("2026-01-01Z"), createdBy: user.id } })).id;
}, 60_000);
afterAll(async () => {
  try {
    if (foreignTenant) {
      await f.owner.season.deleteMany({ where: { tenantId: foreignTenant } }); await f.owner.farm.deleteMany({ where: { tenantId: foreignTenant } }); await f.owner.farmer.deleteMany({ where: { tenantId: foreignTenant } }); await f.owner.organization.delete({ where: { id: foreignTenant } });
    }
    if (foreignUser) await f.owner.user.delete({ where: { id: foreignUser } });
    await f.owner.farmMember.deleteMany({ where: { tenantId: f.scope.tenantId } });
    await f.owner.auditEvent.deleteMany({ where: { actorId: f.scope.actorId } });
    await f.owner.$executeRawUnsafe('DELETE FROM "StockMovement" WHERE "tenantId" = $1::uuid', f.scope.tenantId);
    await f.owner.stockOperation.deleteMany({ where: { tenantId: f.scope.tenantId } });
  } finally { await f.cleanup(); }
});

describe("MYF-P08-AC003 trends from real records under the restricted role (P08-T008)", () => {
  it("fertilizer for the same crop, 100,000 → 118,000 UGX against the earlier season, is +18%", async () => {
    const line = await crop();
    expect(line).toMatchObject({ cropName: "Maize", unavailable: null, season: { seasonId: season }, earlierSeason: { seasonId: earlierSeason, label: "2025" }, soFar: true });
    expect(line.currencies[0].categories).toEqual([{ categoryId: seed.fertilizer, name: "Fertilizer", earlier: value("100000"), current: value("118000"), change: value("+18") }]);
    expect(figure(line, "COSTS")).toMatchObject({ change: value("+18") });
    expect(figure(line, "COST_PER_ACRE")).toMatchObject({ earlier: value("100000"), current: value("118000"), change: value("+18") });
    expect(line.yieldPerAcre).toEqual({ earlier: value("2000"), current: value("3000"), change: value("+50") });
    expect(figure(line, "COST_PER_KG")).toMatchObject({ earlier: value("50"), current: value("39.33"), change: value("-21.3") });
  });
  it("feed for the same animal, 100,000 → 118,000 UGX against the previous batch, is +18%", async () => {
    const line = await bird(newer);
    expect(line).toMatchObject({ unavailable: null, earlierBatch: { batchId: older, label: "Batch 1" }, soFar: false });
    expect(line.currencies[0].categories).toEqual([{ categoryId: seed.feed, name: "Feed", earlier: value("100000"), current: value("118000"), change: value("+18") }]);
    expect(figure(line, "COST_PER_BIRD")).toEqual({ figure: "COST_PER_BIRD", earlier: value("1000"), current: value("1180"), change: value("+18") });
    expect(figure(line, "REVENUE_PER_BIRD")).toMatchObject({ earlier: value("0"), current: value("0"), change: notAvailable("NO_BASELINE") });
  });
  it("the first batch, and a batch of another animal, have nothing to compare with", async () => {
    expect(await bird(older)).toMatchObject({ unavailable: "NO_EARLIER_BATCH", earlierBatch: null, currencies: [] });
    if (duckBatch) expect(await bird(duckBatch)).toMatchObject({ unavailable: "NO_EARLIER_BATCH", earlierBatch: null });
  });
  it("a category with no earlier spending has no percentage, never 0 or infinite", async () => {
    const vet = await spend({ categoryId: seed.veterinary, amount: "5000", batchId: newer });
    try {
      expect((await bird(newer)).currencies[0].categories.find(row => row.categoryId === seed.veterinary)).toMatchObject({ earlier: value("0"), current: value("5000"), change: notAvailable("NO_BASELINE") });
    } finally { await accounts.reverse(farm, { requestId: id(), recordType: "EXPENSE", recordId: vet.recordId, reason }); }
    expect((await bird(newer)).currencies[0].categories.map(row => row.categoryId)).toEqual([seed.feed]);
  });
  it("the earliest season has no earlier season to compare with", async () => {
    expect(await crop({ seasonId: earlierSeason })).toMatchObject({ unavailable: "NO_EARLIER_SEASON", earlierSeason: null, yieldPerAcre: null, currencies: [] });
  });
  it("all records or dates leave crops out until a season is chosen, and batches still show", async () => {
    for (const input of [{ seasonId: "all" }, { from: "2026-01-01" }]) {
      const view = await service.trends(farm, input);
      expect(view).toMatchObject({ season: null, cropsNeedSeason: true, crops: [] });
      expect(view.batches.find(line => line.batchId === newer)?.unavailable).toBeNull();
    }
    expect(await service.trends(farm)).toMatchObject({ season: { seasonId: season }, cropsNeedSeason: false, asOf: now.toISOString() });
  });
  it("names costs that could belong to a side but are not linked to it", async () => {
    const loose = await spend({ categoryId: seed.fertilizer, amount: "700", enterpriseId: maize, occurredOn: "2026-05-01" });
    const unbatched = await spend({ amount: "900", enterpriseId: layers });
    try {
      expect((await crop()).currencies[0].notLinked).toEqual({ current: "700", earlier: "700" });
      expect((await bird(newer)).currencies[0].notLinked).toEqual({ current: "900", earlier: "900" });
    } finally {
      for (const saved of [loose, unbatched]) await accounts.reverse(farm, { requestId: id(), recordType: "EXPENSE", recordId: saved.recordId, reason });
    }
    expect((await crop()).currencies[0].notLinked).toEqual({ current: "0", earlier: "0" });
  });
  it("follows the basis, and a reversed record leaves the comparison", async () => {
    const owed = await spend({ amount: "59000", batchId: newer }, "PURCHASE");
    expect(figure(await bird(newer), "COSTS")).toMatchObject({ current: value("177000"), change: value("+77") });
    expect(figure(await bird(newer, { basis: "CASH" }), "COSTS")).toMatchObject({ current: value("118000"), change: value("+18") });
    await accounts.reverse(farm, { requestId: id(), recordType: "PURCHASE", recordId: owed.recordId, reason });
    expect(figure(await bird(newer), "COSTS")).toMatchObject({ current: value("118000"), change: value("+18") });
  });
});

describe("scale (P8-C4)", () => {
  it("a batch cut off by the 100-batch limit is still the baseline for the oldest batch shown, without a line of its own", async () => {
    const animal = await f.owner.animalTypeCatalog.findFirstOrThrow({ orderBy: { id: "asc" } });
    const base = { tenantId: f.scope.tenantId, farmId: farm, enterpriseId: layers, animalTypeId: animal.id, animalTypeName: animal.name, startingQuantity: 100, purpose: "DUAL_PURPOSE" as const, status: "CLOSED" as const, createdBy: f.scope.actorId };
    // 100 newer batches fill the limit; the cut-off one is older than all of them.
    const cutOff = (await f.owner.poultryBatch.create({ data: { ...base, batchLabel: "Cut off", batchLabelKey: "cut off", acquisitionDate: new Date("2010-01-01Z") } })).id;
    const day = (n: number) => new Date(Date.UTC(2011, 0, 1 + n));
    await f.owner.poultryBatch.createMany({ data: Array.from({ length: 100 }, (_, n) => ({ ...base, id: crypto.randomUUID(), batchLabel: "Scale " + n, batchLabelKey: "scale " + n, acquisitionDate: day(n) })) });
    try {
      // Batch 1, Batch 2 and the ducks are newer, so the 100 shown are 2011-2027 batches minus the oldest scale ones.
      const shown = (await service.trends(farm)).batches;
      expect(shown).toHaveLength(100);
      expect(shown.map(line => line.batchId)).not.toContain(cutOff);
      const oldestShown = [...shown].filter(line => line.animalTypeName === animal.name).pop()!;
      expect(oldestShown.earlierBatch).not.toBeNull();
      expect(oldestShown.unavailable).toBeNull();
    } finally {
      await f.owner.poultryBatch.deleteMany({ where: { tenantId: f.scope.tenantId, OR: [{ id: cutOff }, { batchLabel: { startsWith: "Scale " } }] } });
    }
  });
  it("a crop finds its earlier season even past the 100 seasons the screen lists", async () => {
    const where = { tenantId: f.scope.tenantId, farmId: farm, createdBy: f.scope.actorId };
    await f.owner.season.createMany({ data: Array.from({ length: 100 }, (_, n) => ({ ...where, id: crypto.randomUUID(), label: "Later " + n, startDate: new Date(Date.UTC(2030, 0, 1 + n)), status: "CLOSED" as const })) });
    try {
      expect((await service.dashboard(farm, { seasonId: season })).seasons.map(row => row.seasonId)).not.toContain(earlierSeason);
      expect(await crop({ seasonId: season })).toMatchObject({ earlierSeason: { seasonId: earlierSeason }, unavailable: null });
    } finally { await f.owner.season.deleteMany({ where: { tenantId: f.scope.tenantId, label: { startsWith: "Later " } } }); }
  });
});

describe("trends access (P08-T008)", () => {
  it("another tenant's farm and season are denied, and forged scope or filters are refused", async () => {
    await expect(service.trends(id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.trends(farm, { seasonId: foreignSeason })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.trends(farm, { seasonId: id() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.trends(farm, { tenantId: foreignTenant })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.trends(farm, { basis: "NET" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("reading writes nothing and gives the same answer twice", async () => {
    const before = await f.owner.auditEvent.count();
    expect(await service.trends(farm)).toEqual(await service.trends(farm));
    expect(await f.owner.auditEvent.count()).toBe(before);
  });
});
