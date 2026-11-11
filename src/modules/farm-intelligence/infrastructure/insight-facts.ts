import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { moneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import { quantityString, quantityUnits } from "@/modules/harvest-inventory/domain/harvest";
import type { ProductionEventType } from "@/modules/harvest-inventory/domain/production";
import { MAX_INSIGHT_BATCHES } from "../contracts/insights";
import { trendWindows, type BatchTrendFacts } from "../domain/batch-trends";
import { FEED_USE_DAYS, lossWindow, type FeedStockFacts, type UnitCost, type UnitLossFacts, type UnitSale } from "../domain/thresholds";
import { addDays } from "@/modules/farm-activities/domain/recurrence";

const day = (value: Date) => value.toISOString().slice(0, 10);
export const date = (value: string) => new Date(value + "T00:00:00.000Z");
/** Exact 0.000001 units, never through a JavaScript number; aggregates can be negative before clamping. */
function units(value: Prisma.Decimal | null | undefined): bigint {
  if (!value) return 0n;
  const text = value.toFixed(6), negative = text.startsWith("-"), size = BigInt(text.replace("-", "").replace(".", ""));
  return negative ? -size : size;
}
const quantity = (value: Prisma.Decimal) => quantityString(quantityUnits(value.toFixed(6)));
const money = (value: Prisma.Decimal) => moneyString(moneyUnits(value.toFixed(4)));
const positive = (value: bigint) => quantityString(value < 0n ? 0n : value);
function group<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const row of rows) { const k = key(row); out.set(k, [...(out.get(k) ?? []), row]); }
  return out;
}

export interface BatchInsightFacts { trend: BatchTrendFacts; purpose: string; feed: FeedStockFacts; eggLoss: UnitLossFacts; birdLoss: UnitLossFacts }
export interface CropInsightFacts { cycleId: string; label: string; loss: UnitLossFacts }

/**
 * Everything the Phase 10 rules read for one farm, up to the end of yesterday (the last complete farm day). Reversed
 * entries, operations and records are left out, as in Phase 8 (an appended reversal names what it reverses).
 */
export async function insightFacts(tx: Prisma.TransactionClient, where: { tenantId: string; farmId: string }, today: string) {
  const windows = trendWindows(today), until = date(windows.current.to), loss = lossWindow(today);
  const feedFrom = addDays(today, -FEED_USE_DAYS);
  const [batches, cycles, reversals] = await Promise.all([
    tx.poultryBatch.findMany({ where: { ...where, status: "ACTIVE" }, select: { id: true, batchLabel: true, startingQuantity: true, acquisitionDate: true, purpose: true },
      orderBy: [{ acquisitionDate: "desc" }, { id: "asc" }], take: MAX_INSIGHT_BATCHES + 1 }),
    tx.cropCycle.findMany({ where: { ...where, status: "ACTIVE" }, select: { id: true, cropName: true, enterpriseId: true, seasonId: true, season: { select: { label: true } } },
      orderBy: [{ plantingDate: "desc" }, { id: "asc" }], take: MAX_INSIGHT_BATCHES }),
    tx.stockOperation.findMany({ where: { ...where, type: "REVERSE" }, select: { targetType: true, targetId: true } }),
  ]);
  const reversed = new Set(reversals.map(row => row.targetType + ":" + row.targetId));
  const shown = batches.slice(0, MAX_INSIGHT_BATCHES), batchIds = shown.map(row => row.id), cycleIds = cycles.map(row => row.id);
  const pairs = [...new Map(cycles.map(row => [row.enterpriseId + ":" + row.seasonId, { enterpriseId: row.enterpriseId, seasonId: row.seasonId }])).values()];

  const [entries, batchCosts, eggSales, birdSales, links, seasonCycles, seasonCosts, harvests, cropLosses, cropSales] = await Promise.all([
    // Every entry up to yesterday: flock size needs the whole history before any window.
    tx.productionEvent.findMany({ where: { ...where, batchId: { in: batchIds }, occurredOn: { lte: until } }, select: { id: true, batchId: true, type: true, quantity: true, unit: true, occurredOn: true } }),
    tx.accountingRecord.findMany({ where: { ...where, status: "POSTED", kind: { in: ["EXPENSE", "PURCHASE"] }, batchId: { in: batchIds }, occurredOn: { lte: until } },
      select: { batchId: true, amount: true, currency: true, occurredOn: true, category: { select: { metric: true } } } }),
    tx.stockOperation.findMany({ where: { ...where, type: "SALE", item: { kind: "EGG", batchId: { in: batchIds } }, accountingRecord: { status: "POSTED" }, occurredOn: { gte: date(loss.from), lte: until } },
      select: { id: true, quantity: true, occurredOn: true, item: { select: { batchId: true } }, accountingRecord: { select: { amount: true, currency: true } } } }),
    tx.productionEvent.findMany({ where: { ...where, type: "BIRD_SALE", batchId: { in: batchIds }, accountingRecord: { status: "POSTED" }, occurredOn: { lte: until } },
      select: { id: true, batchId: true, quantity: true, occurredOn: true, accountingRecord: { select: { amount: true, currency: true } } } }),
    tx.batchFeedItem.findMany({ where: { ...where, batchId: { in: batchIds } }, select: { batchId: true, itemId: true, item: { select: { name: true, unit: true } } } }),
    pairs.length ? tx.cropCycle.findMany({ where: { ...where, OR: pairs }, select: { id: true, enterpriseId: true, seasonId: true } }) : [],
    pairs.length ? tx.accountingRecord.findMany({ where: { ...where, status: "POSTED", kind: { in: ["EXPENSE", "PURCHASE"] }, OR: pairs, occurredOn: { lte: until } },
      select: { enterpriseId: true, seasonId: true, amount: true, currency: true, occurredOn: true } }) : [],
    tx.harvest.findMany({ where: { ...where, cropCycleId: { in: cycleIds }, harvestDate: { lte: until } }, select: { id: true, cropCycleId: true, quantity: true, lossQuantity: true } }),
    tx.stockOperation.findMany({ where: { ...where, type: "LOSS", item: { cropCycleId: { in: cycleIds } }, occurredOn: { lte: until } }, select: { id: true, quantity: true, item: { select: { cropCycleId: true } } } }),
    tx.stockOperation.findMany({ where: { ...where, type: "SALE", item: { cropCycleId: { in: cycleIds } }, accountingRecord: { status: "POSTED" }, occurredOn: { lte: until } },
      select: { id: true, quantity: true, occurredOn: true, item: { select: { cropCycleId: true } }, accountingRecord: { select: { amount: true, currency: true } } } }),
  ]);
  const balances = links.length ? await tx.stockMovement.groupBy({ by: ["itemId"], where: { ...where, itemId: { in: [...new Set(links.map(row => row.itemId))] } }, _sum: { quantityDelta: true } }) : [];
  const balance = new Map(balances.map(row => [row.itemId, units(row._sum.quantityDelta)]));

  const liveEntries = entries.filter(row => !reversed.has("PRODUCTION:" + row.id));
  const entriesOf = group(liveEntries, row => row.batchId), costsOf = group(batchCosts, row => row.batchId as string);
  const linkOf = new Map(links.map(row => [row.batchId, row]));
  // Feed given in the last 14 days, added up per feed item over every batch fed from it (shared stores).
  const sharedUse = new Map<string, bigint>();
  for (const row of liveEntries) {
    const link = linkOf.get(row.batchId), on = day(row.occurredOn);
    if (link && row.type === "FEED" && on >= feedFrom) sharedUse.set(link.itemId, (sharedUse.get(link.itemId) ?? 0n) + units(row.quantity));
  }
  const sale = (row: { quantity: Prisma.Decimal; occurredOn: Date; accountingRecord: { amount: Prisma.Decimal; currency: string } | null }): UnitSale[] =>
    row.accountingRecord ? [{ amount: money(row.accountingRecord.amount), currency: row.accountingRecord.currency, quantity: quantity(row.quantity), occurredOn: day(row.occurredOn) }] : [];
  const cost = (row: { amount: Prisma.Decimal; currency: string; occurredOn: Date }): UnitCost => ({ amount: money(row.amount), currency: row.currency, occurredOn: day(row.occurredOn) });

  const batchFacts: BatchInsightFacts[] = shown.map(batch => {
    const own = entriesOf.get(batch.id) ?? [], costs = costsOf.get(batch.id) ?? [], link = linkOf.get(batch.id);
    const trendEntries = own.map(row => ({ type: row.type as ProductionEventType, quantity: quantity(row.quantity), unit: row.unit, occurredOn: day(row.occurredOn) }));
    const laid = own.filter(row => row.type === "EGGS" && day(row.occurredOn) >= loss.from).reduce((total, row) => total + units(row.quantity), 0n);
    const bought = own.filter(row => row.type === "PURCHASE").reduce((total, row) => total + units(row.quantity), 0n);
    return {
      purpose: batch.purpose,
      trend: { batchId: batch.id, label: batch.batchLabel, status: "ACTIVE", startingQuantity: batch.startingQuantity, acquiredOn: day(batch.acquisitionDate), entries: trendEntries,
        feedCosts: costs.filter(row => row.category.metric === "FEED" && day(row.occurredOn) >= windows.earlier.from).map(cost) },
      feed: { item: link ? { itemId: link.itemId, name: link.item.name, unit: link.item.unit, balance: positive(balance.get(link.itemId) ?? 0n) } : null, entries: trendEntries, sharedUseKg: positive(link ? sharedUse.get(link.itemId) ?? 0n : 0n) },
      eggLoss: { rule: "LOSS_PER_EGG", window: loss, produced: positive(laid), costs: costs.map(cost),
        sales: eggSales.filter(row => row.item?.batchId === batch.id && !reversed.has("OPERATION:" + row.id)).flatMap(sale) },
      // Phase 8 cost per bird: every cost linked to the batch so far ÷ birds started (starting quantity + purchases).
      birdLoss: { rule: "LOSS_PER_BIRD", window: null, produced: positive(BigInt(batch.startingQuantity) * 1_000_000n + bought), costs: costs.map(cost),
        sales: birdSales.filter(row => row.batchId === batch.id && !reversed.has("PRODUCTION:" + row.id)).flatMap(sale) },
    };
  });

  const cyclesIn = group(seasonCycles, row => row.enterpriseId + ":" + row.seasonId), costsIn = group(seasonCosts, row => row.enterpriseId + ":" + row.seasonId);
  const kept = new Map<string, bigint>();
  for (const row of harvests) if (!reversed.has("HARVEST:" + row.id)) kept.set(row.cropCycleId, (kept.get(row.cropCycleId) ?? 0n) + units(row.quantity) - units(row.lossQuantity));
  for (const row of cropLosses) if (row.item?.cropCycleId && !reversed.has("OPERATION:" + row.id)) kept.set(row.item.cropCycleId, (kept.get(row.item.cropCycleId) ?? 0n) - units(row.quantity));
  const cropFacts: CropInsightFacts[] = cycles.map(cycle => {
    const pair = cycle.enterpriseId + ":" + cycle.seasonId;
    // Season costs are linked to the enterprise and season, so they can only be read as this cycle's when it is the only one (D-P08-010).
    const blocked = (cyclesIn.get(pair)?.length ?? 0) > 1 ? "MORE_THAN_ONE_CROP" as const : undefined;
    return { cycleId: cycle.id, label: cycle.cropName + ", " + cycle.season.label, loss: { rule: "LOSS_PER_KG", window: null, produced: positive(kept.get(cycle.id) ?? 0n),
      costs: (costsIn.get(pair) ?? []).map(cost), sales: cropSales.filter(row => row.item?.cropCycleId === cycle.id && !reversed.has("OPERATION:" + row.id)).flatMap(sale), ...(blocked ? { blocked } : {}) } };
  });
  return { batches: batchFacts, crops: cropFacts, truncated: batches.length > MAX_INSIGHT_BATCHES };
}
