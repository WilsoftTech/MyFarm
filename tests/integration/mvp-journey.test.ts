import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { farmReportRepository } from "@/modules/farm-accounting/infrastructure/report-repository";
import { StockService } from "@/modules/harvest-inventory/application/stock";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
import { PushService, type SyncCommandServices } from "@/modules/offline-first/application/sync";
import { receiptLookup } from "@/modules/offline-first/infrastructure/receipts";
import { FarmProfitabilityService } from "@/modules/analytics-profitability/application/profitability";
import { metricFactsRepository } from "@/modules/analytics-profitability/infrastructure/metric-facts-repository";
import { dashboardSeasonRepository } from "@/modules/analytics-profitability/infrastructure/repository";

/**
 * MYF-P08-AC004: the source farmer journey end to end on real records under the restricted role. Money and a harvest
 * are entered offline and replayed, including a retry after a lost reply and an interrupted batch; then the farm
 * screen's figures must match the source example exactly and reconcile.
 */
const id = () => crypto.randomUUID();
const seed = { fertilizer: "f4040002-0000-4000-8000-000000000111", labour: "f4040002-0000-4000-8000-000000000109", cropSales: "f4040002-0000-4000-8000-000000000204", otherIncome: "f4040002-0000-4000-8000-000000000201" };
const value = (text: string) => ({ status: "AVAILABLE", value: text });
const now = new Date("2027-12-31T09:00:00.000Z");
const unused = () => Promise.reject(new Error("not part of this journey"));
let f: Awaited<ReturnType<typeof inventoryFixture>>, accounts: FarmAccountingService, stock: StockService, sync: PushService, service: FarmProfitabilityService, farm: string, maize: string, season: string;
const deviceId = id();
const command = (operation: string, payload: Record<string, unknown>) => ({ clientMutationId: id(), deviceId, farmId: farm, operation, payload, baseVersion: null, createdAt: "2026-10-02T08:00:00.000Z" });
const counts = async () => ({
  records: await f.owner.accountingRecord.count({ where: { farmId: farm } }),
  harvests: await f.owner.harvest.count({ where: { farmId: farm } }),
  movements: await f.owner.stockMovement.count({ where: { farmId: farm } }),
  receipts: await f.owner.auditEvent.count({ where: { actorId: f.scope.actorId } }),
});

beforeAll(async () => {
  f = await inventoryFixture();
  farm = f.scope.farmId; maize = f.cycle.enterpriseId; season = f.cycle.seasonId;
  const registry = registryRepository(f.runtime);
  accounts = new FarmAccountingService(f.auth, registry, farmAccountingRepository(f.runtime));
  stock = new StockService(f.auth, registry, stockRepository(f.runtime));
  const services: SyncCommandServices = {
    recordTransaction: (kind, farmId, input) => accounts.recordTransaction(kind, farmId, input),
    recordHarvest: (farmId, input) => f.harvest.record(farmId, input),
    scheduleActivity: unused, recordActivityDone: unused, completeActivity: unused, currentActivity: unused,
    priorReceiptActions: (farmId, requestId) => receiptLookup(f.auth, registry, f.runtime).priorActions(farmId, requestId),
  };
  sync = new PushService(f.auth, services);
  service = new FarmProfitabilityService(f.auth, registry, farmReportRepository(f.runtime), dashboardSeasonRepository(f.runtime), metricFactsRepository(f.runtime), () => now);
  await f.owner.cropCycle.update({ where: { id: f.cycle.id }, data: { areaPlanted: "3" } });
}, 60_000);
afterAll(async () => {
  try {
    await f.owner.$executeRawUnsafe('DELETE FROM "StockMovement" WHERE "tenantId" = $1::uuid', f.scope.tenantId);
    await f.owner.stockOperation.deleteMany({ where: { tenantId: f.scope.tenantId } });
  } finally { await f.cleanup(); }
});

describe("MYF-P08-AC004 source farmer journey with offline replay (P08-T011)", () => {
  it("offline money and harvest commit once each, through a retry and an interrupted batch", async () => {
    const harvest: Record<string, unknown> = { ...f.command() };
    delete harvest.requestId;
    const batch = [
      command("RECORD_EXPENSE", { categoryId: seed.fertilizer, amount: "2100000", currency: "UGX", occurredOn: "2026-03-10", enterpriseId: maize, seasonId: season }),
      command("RECORD_HARVEST", { ...harvest, quantity: "4000", lossQuantity: "250", harvestDate: "2026-07-01" }),
      command("RECORD_INCOME", { categoryId: seed.otherIncome, amount: "300000", currency: "UGX", occurredOn: "2026-07-05", enterpriseId: maize, seasonId: season }),
    ];
    const before = await counts();
    const first = await sync.push({ commands: batch });
    expect(first.results.map(row => row.outcome.status)).toEqual(["COMMITTED", "COMMITTED", "COMMITTED"]);
    // The reply was lost: the phone sends the same batch again, twice at once.
    const [again, racing] = await Promise.all([sync.push({ commands: batch }), sync.push({ commands: batch })]);
    expect(again).toEqual(first);
    expect(racing).toEqual(first);
    const after = await counts();
    expect(after).toEqual({ records: before.records + 2, harvests: before.harvests + 1, movements: before.movements + 2, receipts: before.receipts + 3 });

    // Interrupted: a labour cost commits, the next entry is refused, and the retried batch does not repeat the cost.
    const labour = command("RECORD_EXPENSE", { categoryId: seed.labour, amount: "50000", currency: "UGX", occurredOn: "2026-04-01", enterpriseId: maize, seasonId: season });
    const broken = command("RECORD_EXPENSE", { categoryId: seed.labour, amount: "-1", currency: "UGX", occurredOn: "2026-04-01" });
    expect((await sync.push({ commands: [labour, broken] })).results.map(row => row.outcome.status)).toEqual(["COMMITTED", "INVALID"]);
    expect((await sync.push({ commands: [labour] })).results[0].outcome.status).toBe("COMMITTED");
    expect((await counts()).records).toBe(after.records + 1);
  });
  it("selling online from the harvest completes the journey, and every figure matches and reconciles", async () => {
    const item = await f.owner.harvest.findFirstOrThrow({ where: { farmId: farm } });
    await stock.post(farm, { requestId: id(), itemId: item.itemId, locationId: f.location.storageLocationId, type: "SALE", quantity: "1000", unit: "KG", occurredOn: "2026-08-01", reason: "Sold", sale: { categoryId: seed.cropSales, amount: "1200000", currency: "UGX" } });
    const screen = await service.farmScreen(farm);
    expect(screen.reconciliation).toMatchObject({ reconciled: true, failures: [] });
    expect(screen.reconciliation.checked).toBeGreaterThanOrEqual(6);
    expect(screen.dashboard.season?.seasonId).toBe(season);
    expect(screen.dashboard.currencies).toMatchObject([{ currency: "UGX", revenue: "1500000", expenses: "2150000", recordedSurplus: "-650000", enterprises: [{ enterpriseId: maize, grossMargin: "-650000" }] }]);
    expect(screen.metrics.crops).toMatchObject([{ enterpriseId: maize, acres: value("3"), harvestedKg: "4000", keptKg: "3750", yieldPerAcre: value("1333.33") }]);
    expect(screen.metrics.crops[0].currencies[0]).toMatchObject({ costs: "2150000", costPerKg: value("573.33") });
    expect(screen.metrics.costGroups).toEqual([{ currency: "UGX", labour: "50000", inputs: "2100000", other: "0" }]);
    expect(screen.metrics.stock.items.find(row => row.itemId === item.itemId)).toMatchObject({ quantity: "2750", estimate: value("3300000") });
    expect(screen.trends.crops).toMatchObject([{ unavailable: "NO_EARLIER_SEASON" }]);
  });
  it("still reconciles after a correction, on the cash basis and for all records", async () => {
    const labour = await f.owner.accountingRecord.findFirstOrThrow({ where: { farmId: farm, categoryId: seed.labour } });
    await accounts.reverse(farm, { requestId: id(), recordType: "EXPENSE", recordId: labour.id, reason: "Entered by mistake" });
    for (const input of [{}, { basis: "CASH" }, { seasonId: "all" }, { from: "2026-07-01" }]) {
      const screen = await service.farmScreen(farm, input);
      expect(screen.reconciliation).toMatchObject({ reconciled: true, failures: [] });
      expect(screen.dashboard.currencies[0]).toMatchObject({ expenses: input.from ? "0" : "2100000" });
    }
  });
  it("the one-read farm screen gives exactly what the three separate endpoints give, in every view (P8-C4)", async () => {
    const same = <T extends { asOf: string }>(value: T) => ({ ...value, asOf: "" });
    for (const input of [{}, { basis: "CASH" }, { seasonId: "all" }, { from: "2026-07-01" }, { seasonId: "all", to: "2026-06-30" }]) {
      const screen = await service.farmScreen(farm, input);
      expect(same(screen.dashboard)).toEqual(same(await service.dashboard(farm, input)));
      expect(same(screen.metrics)).toEqual(same(await service.metrics(farm, input)));
      expect(same(screen.trends)).toEqual(same(await service.trends(farm, input)));
    }
  });
  it("another farm is denied before anything is read, offline or on screen", async () => {
    await expect(service.farmScreen(id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const before = await counts();
    const foreign = { ...command("RECORD_EXPENSE", { categoryId: seed.labour, amount: "1", currency: "UGX", occurredOn: "2026-04-01" }), farmId: id() };
    expect((await sync.push({ commands: [foreign] })).results[0].outcome.status).toBe("DENIED");
    expect(await counts()).toEqual(before);
  });
});
