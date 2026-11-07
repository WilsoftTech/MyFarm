import type { RecognitionEvent } from "@/modules/farm-accounting/domain/accounting";
import { moneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import { available, percentString, ratioString, unavailable, type MetricValue, type UnavailableReason } from "./metric";
import { ACRE_SIZE, birdsStarted, cropTotals, MONEY_PER_UNIT_DECIMALS, MONEY_SCALE, QUANTITY_SCALE, sumsByCurrency, type BatchFacts, type CropCycleFacts } from "./metrics";

/**
 * Trends (R003, D-P08-007): how a figure moved against the same crop in an earlier season, or the same animal
 * type's earlier batch, in the same currency and unit. Calculated from exact figures and rounded once, never from
 * rounded display values. This only states the change; explaining it is left to later phases (P0532-P0533).
 */
export interface TrendCycleFacts extends CropCycleFacts { seasonId: string }
export interface TrendBatchFacts extends BatchFacts { animalTypeId: string; acquiredOn: string }
export interface TrendSeason { seasonId: string; label: string; startDate: string }

/** An exact figure before rounding, or why it cannot be calculated. A denominator is always above 0. */
export type ExactFigure = { numerator: bigint; denominator: bigint } | { reason: UnavailableReason };
const exact = (numerator: bigint, denominator: bigint): ExactFigure => ({ numerator, denominator });

export const TREND_FIGURES = ["COSTS", "COST_PER_ACRE", "REVENUE_PER_ACRE", "COST_PER_KG", "COST_PER_BIRD", "REVENUE_PER_BIRD"] as const;
export type TrendFigureName = typeof TREND_FIGURES[number];
/** `change` carries its sign ("+18", "-5.5", "0") and is a percentage of the earlier figure. */
export interface TrendFigure { earlier: MetricValue; current: MetricValue; change: MetricValue }
export interface NamedTrendFigure extends TrendFigure { figure: TrendFigureName }
export interface CategoryTrend extends TrendFigure { categoryId: string; name: string }
export interface TrendCurrency {
  currency: string;
  figures: NamedTrendFigure[];
  /** One line for each cost category with money on either side. */
  categories: CategoryTrend[];
  /** Costs that could belong here but are not linked to it. Above 0 on either side, the comparison may mislead. */
  notLinked: { current: string; earlier: string };
}
/** When no comparison is possible, `unavailable` says why and there are no figures. */
export interface TrendComparison { unavailable: UnavailableReason | null; soFar: boolean; currencies: TrendCurrency[] }
export interface CropTrend extends TrendComparison {
  cropId: string;
  cropName: string;
  season: { seasonId: string; label: string };
  earlierSeason: { seasonId: string; label: string } | null;
  yieldPerAcre: TrendFigure | null;
}
export interface BatchTrend extends TrendComparison {
  batchId: string;
  label: string;
  animalTypeName: string;
  earlierBatch: { batchId: string; label: string } | null;
}

const NO_MONEY = { revenue: 0n, costs: 0n };
/** Whole money figures keep their stored precision; per-unit figures show up to 2 decimals. */
const MONEY_DECIMALS = 4;

function shown(figure: ExactFigure, decimals: number): MetricValue {
  return "reason" in figure ? unavailable(figure.reason) : available(ratioString(figure.numerator, figure.denominator, decimals));
}

/** The change from the earlier figure. An absent or zero baseline gives no percentage, and neither does a current figure that cannot be calculated. */
export function trendFigure(earlier: ExactFigure, current: ExactFigure, decimals: number = MONEY_PER_UNIT_DECIMALS): TrendFigure {
  const figures = { earlier: shown(earlier, decimals), current: shown(current, decimals) };
  if ("reason" in current) return { ...figures, change: unavailable(current.reason) };
  if ("reason" in earlier || earlier.numerator === 0n) return { ...figures, change: unavailable("NO_BASELINE") };
  const difference = current.numerator * earlier.denominator - earlier.numerator * current.denominator;
  const text = percentString(difference, earlier.numerator * current.denominator);
  return { ...figures, change: available(difference > 0n && text !== "0" ? "+" + text : text) };
}
const moneyTrend = (earlier: bigint, current: bigint) => trendFigure(exact(earlier, MONEY_SCALE), exact(current, MONEY_SCALE), MONEY_DECIMALS);

function categorySums(events: readonly RecognitionEvent[], currency: string) {
  const sums = new Map<string, { name: string; units: bigint }>();
  for (const event of events) {
    if (event.currency !== currency || event.effect !== "COST" || !event.categoryId) continue;
    const row = sums.get(event.categoryId) ?? { name: event.categoryName ?? "", units: 0n };
    row.units += moneyUnits(event.amount);
    sums.set(event.categoryId, row);
  }
  return sums;
}
function categoryTrends(earlier: readonly RecognitionEvent[], current: readonly RecognitionEvent[], currency: string): CategoryTrend[] {
  const before = categorySums(earlier, currency), now = categorySums(current, currency);
  return [...new Set([...before.keys(), ...now.keys()])].map(categoryId => ({
    categoryId, name: now.get(categoryId)?.name ?? before.get(categoryId)?.name ?? "",
    ...moneyTrend(before.get(categoryId)?.units ?? 0n, now.get(categoryId)?.units ?? 0n),
  })).sort((a, b) => a.name.localeCompare(b.name) || a.categoryId.localeCompare(b.categoryId));
}
function costsNotLinked(events: readonly RecognitionEvent[], currency: string, counts: (event: RecognitionEvent) => boolean): string {
  return moneyString(events.reduce((total, event) => event.currency === currency && event.effect === "COST" && counts(event) ? total + moneyUnits(event.amount) : total, 0n));
}
/** Every currency with money on either side, or costs not linked on either side, so the warning is never lost. */
function currenciesIn(all: readonly RecognitionEvent[], sides: readonly (readonly RecognitionEvent[])[], ...notLinked: readonly ((currency: string) => string)[]): string[] {
  const own = new Set(sides.flatMap(events => events.map(event => event.currency)));
  return [...new Set(all.map(event => event.currency))].filter(currency => own.has(currency) || notLinked.some(amount => amount(currency) !== "0")).sort((a, b) => a.localeCompare(b));
}

interface CropSide { cycles: TrendCycleFacts[]; events: RecognitionEvent[]; notLinked: (currency: string) => string; mixed: boolean }

/** One crop in one season: every enterprise growing it there, because costs link to the enterprise and season rather than the crop (D-P08-010). */
function cropSide(cycles: readonly TrendCycleFacts[], events: readonly RecognitionEvent[], cropId: string, seasonId: string): CropSide {
  const inSeason = cycles.filter(cycle => cycle.seasonId === seasonId), own = inSeason.filter(cycle => cycle.cropId === cropId);
  const enterprises = new Set(own.map(cycle => cycle.enterpriseId));
  const mine = (enterpriseId: string | null) => enterpriseId !== null && enterprises.has(enterpriseId);
  return {
    cycles: own, mixed: inSeason.some(cycle => enterprises.has(cycle.enterpriseId) && cycle.cropId !== cropId),
    events: events.filter(event => event.seasonId === seasonId && mine(event.enterpriseId)),
    // Costs of these enterprises with no season, or of this season with no enterprise: either could belong here.
    notLinked: currency => costsNotLinked(events, currency, event => event.enterpriseId === null ? event.seasonId === seasonId : !event.seasonId && mine(event.enterpriseId)),
  };
}
function perAcre(area: bigint, units: bigint, scale: bigint): ExactFigure {
  return area === 0n ? { reason: "NO_AREA" } : exact(units * ACRE_SIZE, area * scale);
}
function cropYield(side: CropSide): ExactFigure {
  const { area, harvested } = cropTotals(side.cycles);
  return area > 0n && harvested === 0n ? { reason: "NO_HARVEST" } : perAcre(area, harvested, QUANTITY_SCALE);
}
function cropMoney(side: CropSide, currency: string) {
  const { area, kept } = cropTotals(side.cycles), sums = sumsByCurrency(side.events).get(currency) ?? NO_MONEY;
  const costPerKg: ExactFigure = kept === 0n ? { reason: "NO_HARVEST" } : exact(sums.costs * QUANTITY_SCALE, kept * MONEY_SCALE);
  return { costs: sums.costs, costPerAcre: perAcre(area, sums.costs, MONEY_SCALE), revenuePerAcre: perAcre(area, sums.revenue, MONEY_SCALE), costPerKg };
}

/** Each crop of the chosen season against the most recent earlier season that grew it. `events` must not be narrowed by season or dates. */
export function cropTrends(cycles: readonly TrendCycleFacts[], events: readonly RecognitionEvent[], seasons: readonly TrendSeason[], seasonId: string): CropTrend[] {
  const season = seasons.find(row => row.seasonId === seasonId);
  if (!season) return [];
  const crops = new Map(cycles.filter(cycle => cycle.seasonId === seasonId).map(cycle => [cycle.cropId, cycle.cropName]));
  const earlierSeasons = seasons.filter(row => row.startDate < season.startDate).sort((a, b) => b.startDate.localeCompare(a.startDate) || a.seasonId.localeCompare(b.seasonId));
  return [...crops.entries()].sort(([a, nameA], [b, nameB]) => nameA.localeCompare(nameB) || a.localeCompare(b)).map(([cropId, cropName]): CropTrend => {
    const before = earlierSeasons.find(row => cycles.some(cycle => cycle.seasonId === row.seasonId && cycle.cropId === cropId));
    const current = cropSide(cycles, events, cropId, seasonId), earlier = before ? cropSide(cycles, events, cropId, before.seasonId) : null;
    const about = { cropId, cropName, season: { seasonId, label: season.label }, earlierSeason: before ? { seasonId: before.seasonId, label: before.label } : null };
    const soFar = [...current.cycles, ...(earlier?.cycles ?? [])].some(cycle => cycle.status === "ACTIVE");
    if (!earlier) return { ...about, unavailable: "NO_EARLIER_SEASON", soFar, yieldPerAcre: null, currencies: [] };
    if (current.mixed || earlier.mixed) return { ...about, unavailable: "MORE_THAN_ONE_CROP", soFar, yieldPerAcre: null, currencies: [] };
    return {
      ...about, unavailable: null, soFar, yieldPerAcre: trendFigure(cropYield(earlier), cropYield(current)),
      currencies: currenciesIn(events, [current.events, earlier.events], current.notLinked, earlier.notLinked).map(currency => {
        const now = cropMoney(current, currency), then = cropMoney(earlier, currency);
        return {
          currency, categories: categoryTrends(earlier.events, current.events, currency),
          figures: [
            { figure: "COSTS", ...moneyTrend(then.costs, now.costs) },
            { figure: "COST_PER_ACRE", ...trendFigure(then.costPerAcre, now.costPerAcre) },
            { figure: "REVENUE_PER_ACRE", ...trendFigure(then.revenuePerAcre, now.revenuePerAcre) },
            { figure: "COST_PER_KG", ...trendFigure(then.costPerKg, now.costPerKg) },
          ],
          notLinked: { current: current.notLinked(currency), earlier: earlier.notLinked(currency) },
        };
      }),
    };
  });
}

/** Each batch against the most recent earlier batch of the same animal type. `events` must not be narrowed by season or dates. */
export function batchTrends(batches: readonly TrendBatchFacts[], events: readonly RecognitionEvent[]): BatchTrend[] {
  return batches.map((batch): BatchTrend => {
    const before = batches.filter(row => row.animalTypeId === batch.animalTypeId && row.acquiredOn < batch.acquiredOn).sort((a, b) => b.acquiredOn.localeCompare(a.acquiredOn) || a.batchId.localeCompare(b.batchId))[0];
    const about = { batchId: batch.batchId, label: batch.label, animalTypeName: batch.animalTypeName, earlierBatch: before ? { batchId: before.batchId, label: before.label } : null };
    const soFar = batch.status === "ACTIVE" || before?.status === "ACTIVE";
    if (!before) return { ...about, unavailable: "NO_EARLIER_BATCH", soFar, currencies: [] };
    const current = events.filter(event => event.batchId === batch.batchId), earlier = events.filter(event => event.batchId === before.batchId);
    const started = birdsStarted(batch), startedBefore = birdsStarted(before), sumsNow = sumsByCurrency(current), sumsBefore = sumsByCurrency(earlier);
    const perBird = (units: bigint, birds: bigint): ExactFigure => birds === 0n ? { reason: "NO_BIRDS" } : exact(units * QUANTITY_SCALE, birds * MONEY_SCALE);
    const notLinkedNow = (currency: string) => costsNotLinked(events, currency, event => event.enterpriseId === batch.enterpriseId && !event.batchId);
    const notLinkedBefore = (currency: string) => costsNotLinked(events, currency, event => event.enterpriseId === before.enterpriseId && !event.batchId);
    return {
      ...about, unavailable: null, soFar,
      currencies: currenciesIn(events, [current, earlier], notLinkedNow, notLinkedBefore).map(currency => {
        const now = sumsNow.get(currency) ?? NO_MONEY, then = sumsBefore.get(currency) ?? NO_MONEY;
        return {
          currency, categories: categoryTrends(earlier, current, currency),
          figures: [
            { figure: "COSTS", ...moneyTrend(then.costs, now.costs) },
            { figure: "COST_PER_BIRD", ...trendFigure(perBird(then.costs, startedBefore), perBird(now.costs, started)) },
            { figure: "REVENUE_PER_BIRD", ...trendFigure(perBird(then.revenue, startedBefore), perBird(now.revenue, started)) },
          ],
          notLinked: { current: notLinkedNow(currency), earlier: notLinkedBefore(currency) },
        };
      }),
    };
  });
}
