import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { moneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import { quantityString } from "@/modules/harvest-inventory/domain/harvest";
import { MAX_METRIC_BATCHES, MAX_METRIC_ITEMS, type MetricFactsRepository } from "../contracts/profitability";
import type { LastSale } from "../domain/metrics";

/** Exact 0.000001 units; aggregates can pass one stored quantity, so this never goes through a JavaScript number. */
function units(value: Prisma.Decimal | null | undefined): bigint {
  if (!value) return 0n;
  const text = value.toFixed(6), negative = text.startsWith("-");
  const size = BigInt(text.replace("-", "").replace(".", ""));
  return negative ? -size : size;
}
const quantity = (value: bigint) => quantityString(value < 0n ? 0n : value);
const day = (value: Date) => value.toISOString().slice(0, 10);
function addTo(totals: Map<string, bigint>, key: string, amount: bigint) { totals.set(key, (totals.get(key) ?? 0n) + amount); }
const money = (value: Prisma.Decimal) => moneyString(moneyUnits(value.toFixed(4)));

export function metricFactsRepository(db: PrismaClient): MetricFactsRepository {
  return {
    async facts(scope, seasonId) {
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      const batchSelect = { id: true, batchLabel: true, enterpriseId: true, animalTypeId: true, animalTypeName: true, acquisitionDate: true, status: true, startingQuantity: true } as const;
      const [cycles, batches, items, groups, reversals, seasons] = await Promise.all([
        db.cropCycle.findMany({ where: { ...where, ...(seasonId ? { seasonId } : {}) }, select: { id: true, enterpriseId: true, seasonId: true, cropId: true, cropName: true, areaPlanted: true, areaUnit: true, status: true, enterprise: { select: { name: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
        db.poultryBatch.findMany({ where, select: batchSelect, orderBy: [{ acquisitionDate: "desc" }, { id: "asc" }], take: MAX_METRIC_BATCHES }),
        db.inventoryItem.findMany({ where, select: { id: true, name: true, unit: true, kind: true, batchId: true }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: MAX_METRIC_ITEMS }),
        db.transactionCategory.findMany({ where: { costGroup: { not: null } }, select: { id: true, costGroup: true } }),
        // Reversal is an appended record, so a source's figures exclude it by looking up its reversal.
        db.stockOperation.findMany({ where: { ...where, type: "REVERSE" }, select: { targetType: true, targetId: true } }),
        // Small rows and few per farm: trends look for an earlier season among all of them (P8-C4).
        db.season.findMany({ where, select: { id: true, label: true, startDate: true }, orderBy: [{ startDate: "desc" }, { id: "asc" }] }),
      ]);
      // When the limit cut older batches off, the batch just before the oldest one shown of each animal type is read too,
      // so that one still has a baseline (P8-C4). At most one extra row per animal type.
      const earlier = batches.length < MAX_METRIC_BATCHES ? [] : (await Promise.all([...new Set(batches.map(row => row.animalTypeId))].map(animalTypeId => {
        const ofType = batches.filter(row => row.animalTypeId === animalTypeId);
        const oldest = ofType.reduce((first, row) => row.acquisitionDate < first ? row.acquisitionDate : first, ofType[0].acquisitionDate);
        return db.poultryBatch.findFirst({ where: { ...where, animalTypeId, acquisitionDate: { lt: oldest } }, select: batchSelect, orderBy: [{ acquisitionDate: "desc" }, { id: "asc" }] });
      }))).flatMap(row => row ? [row] : []);
      const reversed = new Set(reversals.map(row => row.targetType + ":" + row.targetId));
      const cycleIds = cycles.map(row => row.id), batchIds = [...batches, ...earlier].map(row => row.id), itemIds = items.map(row => row.id);
      const [harvests, losses, events, balances, stockSales, birdSales] = await Promise.all([
        db.harvest.findMany({ where: { ...where, cropCycleId: { in: cycleIds } }, select: { id: true, cropCycleId: true, quantity: true, lossQuantity: true } }),
        db.stockOperation.findMany({ where: { ...where, type: "LOSS", item: { cropCycleId: { in: cycleIds } } }, select: { id: true, quantity: true, item: { select: { cropCycleId: true } } } }),
        db.productionEvent.findMany({ where: { ...where, batchId: { in: batchIds }, type: { in: ["PURCHASE", "MORTALITY"] } }, select: { id: true, batchId: true, type: true, quantity: true } }),
        db.stockMovement.groupBy({ by: ["itemId"], where: { ...where, itemId: { in: itemIds } }, _sum: { quantityDelta: true } }),
        db.stockOperation.findMany({ where: { ...where, type: "SALE", itemId: { in: itemIds }, accountingRecord: { status: "POSTED" } }, select: { id: true, itemId: true, quantity: true, occurredOn: true, createdAt: true, accountingRecord: { select: { amount: true, currency: true } } } }),
        db.productionEvent.findMany({ where: { ...where, type: "BIRD_SALE", accountingRecord: { status: "POSTED" } }, select: { id: true, batchId: true, quantity: true, occurredOn: true, createdAt: true, accountingRecord: { select: { amount: true, currency: true } } } }),
      ]);
      const harvested = new Map<string, bigint>(), lost = new Map<string, bigint>();
      for (const row of harvests) {
        if (reversed.has("HARVEST:" + row.id)) continue;
        addTo(harvested, row.cropCycleId, units(row.quantity));
        addTo(lost, row.cropCycleId, units(row.lossQuantity));
      }
      for (const row of losses) if (row.item?.cropCycleId && !reversed.has("OPERATION:" + row.id)) addTo(lost, row.item.cropCycleId, units(row.quantity));
      const purchased = new Map<string, bigint>(), deaths = new Map<string, bigint>();
      for (const row of events) if (!reversed.has("PRODUCTION:" + row.id)) addTo(row.type === "PURCHASE" ? purchased : deaths, row.batchId, units(row.quantity));

      // The latest sale per item, newest by date and then by when it was entered.
      const latest = new Map<string, { sale: LastSale; at: number }>();
      const consider = (itemId: string | null | undefined, row: { quantity: Prisma.Decimal; occurredOn: Date; createdAt: Date; accountingRecord: { amount: Prisma.Decimal; currency: string } | null }) => {
        if (!itemId || !row.accountingRecord) return;
        const prior = latest.get(itemId), soldOn = day(row.occurredOn), at = row.createdAt.getTime();
        if (prior && (prior.sale.soldOn > soldOn || (prior.sale.soldOn === soldOn && prior.at >= at))) return;
        latest.set(itemId, { at, sale: { amount: money(row.accountingRecord.amount), currency: row.accountingRecord.currency, quantity: quantity(units(row.quantity)), soldOn } });
      };
      for (const row of stockSales) if (!reversed.has("OPERATION:" + row.id)) consider(row.itemId, row);
      const birdItems = new Map(items.filter(row => row.kind === "BIRD" && row.batchId).map(row => [row.batchId as string, row.id]));
      for (const row of birdSales) if (!reversed.has("PRODUCTION:" + row.id)) consider(birdItems.get(row.batchId), row);
      const balance = new Map(balances.map(row => [row.itemId, units(row._sum.quantityDelta)]));

      const batchFacts = (row: (typeof batches)[number]) => ({ batchId: row.id, label: row.batchLabel, enterpriseId: row.enterpriseId, animalTypeId: row.animalTypeId, animalTypeName: row.animalTypeName, acquiredOn: day(row.acquisitionDate), status: row.status, startingQuantity: row.startingQuantity, birdsPurchased: quantity(purchased.get(row.id) ?? 0n), deaths: quantity(deaths.get(row.id) ?? 0n) });
      return {
        cycles: cycles.map(row => ({ cycleId: row.id, enterpriseId: row.enterpriseId, seasonId: row.seasonId, cropId: row.cropId, cropName: row.cropName, areaPlanted: quantity(units(row.areaPlanted)), areaUnit: row.areaUnit, status: row.status, harvestedKg: quantity(harvested.get(row.id) ?? 0n), lostKg: quantity(lost.get(row.id) ?? 0n) })),
        enterprises: [...new Map(cycles.map(row => [row.enterpriseId, { enterpriseId: row.enterpriseId, name: row.enterprise.name }])).values()],
        batches: batches.map(batchFacts), earlierBatches: earlier.map(batchFacts),
        seasons: seasons.map(row => ({ seasonId: row.id, label: row.label, startDate: day(row.startDate) })),
        items: items.map(row => ({ itemId: row.id, name: row.name, unit: row.unit, quantity: quantity(balance.get(row.id) ?? 0n), lastSale: latest.get(row.id)?.sale ?? null })),
        costGroups: groups.flatMap(row => row.costGroup ? [{ categoryId: row.id, group: row.costGroup }] : []),
      };
    },
  };
}
