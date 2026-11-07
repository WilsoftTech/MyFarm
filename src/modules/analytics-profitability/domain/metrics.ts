import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RecognitionEvent } from "@/modules/farm-accounting/domain/accounting";
import { moneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import type { AreaUnit } from "@/modules/farmer-registry/domain/rules";
import { quantityString } from "@/modules/harvest-inventory/domain/harvest";
import { available, percentString, ratioString, unavailable, type MetricValue } from "./metric";

/**
 * The approved formula catalog (R002, D-P08-005 to D-P08-007, D-P08-009 to D-P08-011; see
 * docs/architecture/metric-formulas.md). Figures are calculated exactly and rounded once, only for display:
 * money per unit and kg per acre to 2 decimals, percentages to 1. Amounts in different currencies are never combined.
 */
export const MONEY_PER_UNIT_DECIMALS = 2;
/** Money amounts are in 0.0001 units and quantities in 0.000001 units. */
export const MONEY_SCALE = 10_000n, QUANTITY_SCALE = 1_000_000n;
const HUNDREDTHS = 100n;

/** Exact sizes in ten-millionths of a square metre: 1 acre is exactly 4,046.8564224 square metres. */
const AREA_SIZE: Record<AreaUnit, bigint> = { ACRE: 40_468_564_224n, HECTARE: 100_000_000_000n, SQUARE_METRE: 10_000_000n };
export const ACRE_SIZE = AREA_SIZE.ACRE * QUANTITY_SCALE;

/** Totals can pass the limits of one stored quantity, so facts keep their exact digits without that limit. */
function factUnits(value: string): bigint {
  if (!/^\d{1,100}(?:\.\d{1,6})?$/.test(value)) throw new FoundationError("INVALID_INPUT");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * QUANTITY_SCALE + BigInt(fraction.padEnd(6, "0"));
}

interface Sums { revenue: bigint; costs: bigint }
export function sumsByCurrency(events: readonly RecognitionEvent[]): Map<string, Sums> {
  const totals = new Map<string, Sums>();
  for (const event of events) {
    const sums = totals.get(event.currency) ?? { revenue: 0n, costs: 0n };
    if (event.effect === "REVENUE") sums.revenue += moneyUnits(event.amount); else sums.costs += moneyUnits(event.amount);
    totals.set(event.currency, sums);
  }
  return new Map([...totals.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** A crop cycle in the chosen view. Quantities are kg. A reversed harvest or loss must already be excluded. */
export interface CropCycleFacts {
  cycleId: string;
  enterpriseId: string;
  cropId: string;
  cropName: string;
  areaPlanted: string;
  areaUnit: AreaUnit;
  status: "ACTIVE" | "CLOSED";
  harvestedKg: string;
  lostKg: string;
}
/** Exact totals of some cycles: area in the units ACRE_SIZE is measured in, and kg in QUANTITY_SCALE units. Loss cannot pass the harvest. */
export function cropTotals(rows: readonly CropCycleFacts[]) {
  const area = rows.reduce((total, row) => total + factUnits(row.areaPlanted) * AREA_SIZE[row.areaUnit], 0n);
  const harvested = rows.reduce((total, row) => total + factUnits(row.harvestedKg), 0n);
  const lost = rows.reduce((total, row) => total + factUnits(row.lostKg), 0n);
  return { area, harvested, kept: harvested > lost ? harvested - lost : 0n };
}
/** Per-area and per-kg figures need a season or all records: a date range holds part of a cycle's costs but all of its acres. */
export type MetricView = "SEASON" | "ALL_RECORDS" | "DATE_RANGE";
export interface CropCurrencyMetrics { currency: string; costs: string; revenue: string; costPerAcre: MetricValue; revenuePerAcre: MetricValue; costPerKg: MetricValue }
export interface CropMetrics {
  enterpriseId: string;
  crops: string[];
  /** A cycle is still open, so these figures may yet change (D-P08-005). */
  soFar: boolean;
  acres: MetricValue;
  harvestedKg: string;
  keptKg: string;
  yieldPerAcre: MetricValue;
  currencies: CropCurrencyMetrics[];
}

/** One line for each enterprise with crop cycles in the view; `events` are the view's events. */
export function cropMetrics(cycles: readonly CropCycleFacts[], events: readonly RecognitionEvent[], view: MetricView): CropMetrics[] {
  const byEnterprise = new Map<string, CropCycleFacts[]>();
  for (const cycle of cycles) byEnterprise.set(cycle.enterpriseId, [...(byEnterprise.get(cycle.enterpriseId) ?? []), cycle]);
  return [...byEnterprise.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([enterpriseId, rows]) => {
    const { area, harvested, kept } = cropTotals(rows);
    const crops = new Set(rows.map(row => row.cropId));
    const blocked = view === "DATE_RANGE" ? "DATE_RANGE" as const : crops.size > 1 ? "MORE_THAN_ONE_CROP" as const : null;
    const perAcre = (units: bigint, scale: bigint) => blocked ? unavailable(blocked) : area === 0n ? unavailable("NO_AREA") : available(ratioString(units * ACRE_SIZE, area * scale, MONEY_PER_UNIT_DECIMALS));
    return {
      enterpriseId, crops: [...new Set(rows.map(row => row.cropName))].sort((a, b) => a.localeCompare(b)), soFar: rows.some(row => row.status === "ACTIVE"),
      acres: area === 0n ? unavailable("NO_AREA") : available(ratioString(area, ACRE_SIZE, MONEY_PER_UNIT_DECIMALS)),
      harvestedKg: quantityString(harvested), keptKg: quantityString(kept),
      yieldPerAcre: !blocked && area > 0n && harvested === 0n ? unavailable("NO_HARVEST") : perAcre(harvested, QUANTITY_SCALE),
      currencies: [...sumsByCurrency(events.filter(event => event.enterpriseId === enterpriseId)).entries()].map(([currency, sums]) => ({
        currency, costs: moneyString(sums.costs), revenue: moneyString(sums.revenue),
        costPerAcre: perAcre(sums.costs, MONEY_SCALE), revenuePerAcre: perAcre(sums.revenue, MONEY_SCALE),
        // Also the break-even price: what each kg kept must sell for to cover the costs (D-P08-005, D-P08-011).
        costPerKg: blocked ? unavailable(blocked) : kept === 0n ? unavailable("NO_HARVEST") : available(ratioString(sums.costs * QUANTITY_SCALE, kept * MONEY_SCALE, MONEY_PER_UNIT_DECIMALS)),
      })),
    };
  });
}

/** A poultry batch. Counts are whole birds. Reversed purchases and deaths must already be excluded. */
export interface BatchFacts {
  batchId: string;
  label: string;
  enterpriseId: string;
  animalTypeName: string;
  status: "ACTIVE" | "CLOSED";
  startingQuantity: number;
  birdsPurchased: string;
  deaths: string;
}
export interface BatchCurrencyMetrics {
  currency: string;
  costs: string;
  revenue: string;
  costPerBird: MetricValue;
  revenuePerBird: MetricValue;
  /** The enterprise's costs linked to no batch: this batch's cost figures may be incomplete (D-P08-003). */
  enterpriseCostsNotLinked: string;
}
export interface BatchMetrics { batchId: string; label: string; enterpriseId: string; animalTypeName: string; soFar: boolean; birdsStarted: string; deaths: string; mortalityRate: MetricValue; currencies: BatchCurrencyMetrics[] }

/** Starting quantity plus later purchases, in QUANTITY_SCALE units (D-P08-006). */
export function birdsStarted(batch: BatchFacts): bigint {
  return BigInt(batch.startingQuantity) * QUANTITY_SCALE + factUnits(batch.birdsPurchased);
}

/** Whole-life figures for each batch; `events` must not be narrowed by season or dates, and carry each record's batch. */
export function batchMetrics(batches: readonly BatchFacts[], events: readonly RecognitionEvent[]): BatchMetrics[] {
  return batches.map(batch => {
    const started = birdsStarted(batch), deaths = factUnits(batch.deaths);
    const notLinked = new Map<string, bigint>();
    for (const event of events) if (event.enterpriseId === batch.enterpriseId && event.effect === "COST" && !event.batchId) notLinked.set(event.currency, (notLinked.get(event.currency) ?? 0n) + moneyUnits(event.amount));
    const linked = sumsByCurrency(events.filter(event => event.batchId === batch.batchId));
    const currencies = [...new Set([...linked.keys(), ...notLinked.keys()])].sort((a, b) => a.localeCompare(b));
    const perBird = (units: bigint) => started === 0n ? unavailable("NO_BIRDS") : available(ratioString(units * QUANTITY_SCALE, started * MONEY_SCALE, MONEY_PER_UNIT_DECIMALS));
    return {
      batchId: batch.batchId, label: batch.label, enterpriseId: batch.enterpriseId, animalTypeName: batch.animalTypeName, soFar: batch.status === "ACTIVE",
      birdsStarted: quantityString(started), deaths: quantityString(deaths), mortalityRate: started === 0n ? unavailable("NO_BIRDS") : available(percentString(deaths, started)),
      currencies: currencies.map(currency => {
        const sums = linked.get(currency) ?? { revenue: 0n, costs: 0n };
        return { currency, costs: moneyString(sums.costs), revenue: moneyString(sums.revenue), costPerBird: perBird(sums.costs), revenuePerBird: perBird(sums.revenue), enterpriseCostsNotLinked: moneyString(notLinked.get(currency) ?? 0n) };
      }),
    };
  });
}

export const COST_GROUPS = ["LABOUR", "INPUT"] as const;
export type CostGroup = typeof COST_GROUPS[number];
export interface CostGroupTotals { currency: string; labour: string; inputs: string; other: string }

/** Costs split by the group stored on their category (D-P08-009); the three parts always add up to all costs. */
export function costGroupTotals(events: readonly RecognitionEvent[], groups: ReadonlyMap<string, CostGroup>): CostGroupTotals[] {
  const totals = new Map<string, { LABOUR: bigint; INPUT: bigint; other: bigint }>();
  for (const event of events) {
    if (event.effect !== "COST") continue;
    const sums = totals.get(event.currency) ?? { LABOUR: 0n, INPUT: 0n, other: 0n };
    sums[(event.categoryId && groups.get(event.categoryId)) || "other"] += moneyUnits(event.amount);
    totals.set(event.currency, sums);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, sums]) => ({ currency, labour: moneyString(sums.LABOUR), inputs: moneyString(sums.INPUT), other: moneyString(sums.other) }));
}

/** The item's most recent sale that has not been reversed. */
export interface LastSale { amount: string; currency: string; quantity: string; soldOn: string }
export interface StockItemFacts { itemId: string; name: string; unit: string; quantity: string; lastSale: LastSale | null }
export interface StockValueLine { itemId: string; name: string; unit: string; quantity: string; pricePerUnit: MetricValue; estimate: MetricValue; currency: string | null; soldOn: string | null }
export interface StockValue { items: StockValueLine[]; totals: { currency: string; estimate: string }[] }

/**
 * Quantity in stock × the last sale price: an estimate, kept out of surplus and margin, so unsold stock never
 * counts as earnings (D-P08-004). A total adds the rounded lines, so it visibly adds up.
 */
export function stockValue(items: readonly StockItemFacts[]): StockValue {
  const totals = new Map<string, bigint>();
  const lines = items.filter(item => factUnits(item.quantity) > 0n).map((item): StockValueLine => {
    const sale = item.lastSale, sold = sale ? factUnits(sale.quantity) : 0n;
    if (!sale || sold === 0n) return { itemId: item.itemId, name: item.name, unit: item.unit, quantity: item.quantity, pricePerUnit: unavailable("NEVER_SOLD"), estimate: unavailable("NEVER_SOLD"), currency: null, soldOn: null };
    const amount = moneyUnits(sale.amount), divisor = 2n * sold * MONEY_SCALE;
    // In exact hundredths, so a very large estimate cannot pass the limits of a stored amount.
    const hundredths = (amount * factUnits(item.quantity) * HUNDREDTHS * 2n + sold * MONEY_SCALE) / divisor;
    totals.set(sale.currency, (totals.get(sale.currency) ?? 0n) + hundredths);
    return { itemId: item.itemId, name: item.name, unit: item.unit, quantity: item.quantity, pricePerUnit: available(ratioString(amount * QUANTITY_SCALE, sold * MONEY_SCALE, MONEY_PER_UNIT_DECIMALS)), estimate: available(ratioString(hundredths, HUNDREDTHS, MONEY_PER_UNIT_DECIMALS)), currency: sale.currency, soldOn: sale.soldOn };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId));
  return { items: lines, totals: [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([currency, units]) => ({ currency, estimate: ratioString(units, HUNDREDTHS, MONEY_PER_UNIT_DECIMALS) })) };
}
