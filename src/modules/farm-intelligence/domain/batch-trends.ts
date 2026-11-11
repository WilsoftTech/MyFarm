import { ratioString } from "@/modules/analytics-profitability/domain/metric";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { moneyUnits } from "@/modules/farm-accounting/domain/money";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
import { quantityUnits } from "@/modules/harvest-inventory/domain/harvest";
import { assertProductionQuantity, type ProductionEventType } from "@/modules/harvest-inventory/domain/production";
import { BLOCK_DAYS, EGG_FALL, FEED_RISE, MIN_BIRDS, MIN_RECORDED_DAYS_PER_BLOCK, MORTALITY_RISE_POINTS, RULES, WINDOW_DAYS, type RuleKey, type Severity } from "./rules";

/**
 * Batch trends (MYF-P10-R001): rising feed cost, falling eggs and rising mortality for one poultry batch, from its
 * own records only. Every figure is exact integer arithmetic, compared with its threshold before any rounding, and
 * rounded once for display. Nothing here reads a clock: the caller passes the farm's date.
 */
export interface BatchEntry { type: ProductionEventType; quantity: string; unit: string; occurredOn: string }
/** A Feed-category cost linked to the batch. Reversed records must already be left out. */
export interface FeedCost { amount: string; currency: string; occurredOn: string }
export interface BatchTrendFacts {
  batchId: string;
  label: string;
  status: "ACTIVE" | "CLOSED";
  startingQuantity: number;
  acquiredOn: string;
  /** Every production entry of the batch up to the end of the current window. Reversed entries must already be left out. */
  entries: readonly BatchEntry[];
  feedCosts: readonly FeedCost[];
}

export interface DateWindow { from: string; to: string }
export interface TrendWindows { earlier: DateWindow; current: DateWindow }
export const MISSING_REASONS = ["BATCH_TOO_YOUNG", "TOO_FEW_BIRDS", "FEW_EGG_DAYS", "FEW_RECORDED_DAYS", "NO_FEED_COST", "NO_EARLIER_EGGS"] as const;
export type MissingReason = typeof MISSING_REASONS[number];
/** Days with records in each 7-day block of a window, oldest block first. */
export interface WindowCoverage { birdsAtStart: string; recordedDays: number[]; eggDays: number[] }
export interface TrendCoverage { earlier: WindowCoverage; current: WindowCoverage }
/** A change kept as an exact fraction, so a later evaluation can tell whether it got worse without rounding. */
export interface ExactChange { numerator: string; denominator: string }
export type TrendFigureRule = Extract<RuleKey, "FEED_COST_RISING" | "EGGS_FALLING" | "MORTALITY_RISING">;
export interface TrendFigure {
  rule: TrendFigureRule;
  currency: string | null;
  outcome: "RAISED" | "NOT_RAISED" | "NOT_ENOUGH_RECORDS";
  missing: MissingReason[];
  /** FEED_COST_RISING: cost per bird in the window. EGGS_FALLING: eggs per 100 birds a day. MORTALITY_RISING: % of birds that died. */
  earlier: string | null;
  current: string | null;
  /** % change for feed and eggs; percentage points for mortality. */
  change: string | null;
  exactChange: ExactChange | null;
}
export interface InsightCandidate { ruleKey: RuleKey; ruleVersion: number; severity: Severity; batchId: string; currency: string | null; figures: TrendFigure[] }
export interface BatchTrendEvaluation { batchId: string; label: string; windows: TrendWindows; coverage: TrendCoverage; figures: TrendFigure[]; candidates: InsightCandidate[] }

const SCALE = 1_000_000n, MONEY_SCALE = 10_000n;

/** The last 28 complete farm days and the 28 before them. Today is left out: its records are usually not finished. */
export function trendWindows(today: string): TrendWindows {
  if (!isCalendarDate(today)) throw new FoundationError("INVALID_INPUT");
  return {
    earlier: { from: addDays(today, -2 * WINDOW_DAYS), to: addDays(today, -WINDOW_DAYS - 1) },
    current: { from: addDays(today, -WINDOW_DAYS), to: addDays(today, -1) },
  };
}

const daysOf = (window: DateWindow) => Array.from({ length: WINDOW_DAYS }, (_, index) => addDays(window.from, index));
const inWindow = (date: string, window: DateWindow) => date >= window.from && date <= window.to;
const whole = (entry: BatchEntry) => quantityUnits(entry.quantity) / SCALE;

/** Birds alive at the start of each day: the opening count from the acquisition date, then each earlier day's purchases, deaths and sales. */
function flockByDay(facts: BatchTrendFacts, days: readonly string[]): bigint[] {
  const change = new Map<string, bigint>();
  for (const entry of facts.entries) {
    const delta = entry.type === "PURCHASE" ? whole(entry) : entry.type === "MORTALITY" || entry.type === "BIRD_SALE" ? -whole(entry) : 0n;
    if (delta !== 0n) change.set(entry.occurredOn, (change.get(entry.occurredOn) ?? 0n) + delta);
  }
  return days.map(day => {
    if (day < facts.acquiredOn) return 0n;
    let alive = BigInt(facts.startingQuantity);
    for (const [date, delta] of change) if (date < day) alive += delta;
    if (alive < 0n) throw new FoundationError("CONFLICT");
    return alive;
  });
}

interface WindowTotals { birdDays: bigint; birdsAtStart: bigint; atRisk: bigint; deaths: bigint; eggs: bigint; costs: Map<string, bigint>; coverage: WindowCoverage; enoughRecorded: boolean; enoughEggs: boolean }
function windowTotals(facts: BatchTrendFacts, window: DateWindow): WindowTotals {
  const days = daysOf(window), flock = flockByDay(facts, days);
  const recorded = new Set<string>(), eggDays = new Set<string>();
  let deaths = 0n, eggs = 0n, purchased = 0n;
  for (const entry of facts.entries) {
    if (!inWindow(entry.occurredOn, window)) continue;
    recorded.add(entry.occurredOn);
    if (entry.type === "EGGS") { eggDays.add(entry.occurredOn); eggs += whole(entry); }
    if (entry.type === "MORTALITY") deaths += whole(entry);
    if (entry.type === "PURCHASE") purchased += whole(entry);
  }
  const costs = new Map<string, bigint>();
  for (const cost of facts.feedCosts) if (inWindow(cost.occurredOn, window)) costs.set(cost.currency, (costs.get(cost.currency) ?? 0n) + moneyUnits(cost.amount));
  const blocks = (set: Set<string>) => Array.from({ length: WINDOW_DAYS / BLOCK_DAYS }, (_, block) => days.slice(block * BLOCK_DAYS, (block + 1) * BLOCK_DAYS).filter(day => set.has(day)).length);
  const recordedDays = blocks(recorded), eggDayCounts = blocks(eggDays);
  return {
    birdDays: flock.reduce((total, alive) => total + alive, 0n), birdsAtStart: flock[0], atRisk: flock[0] + purchased, deaths, eggs, costs,
    coverage: { birdsAtStart: flock[0].toString(), recordedDays, eggDays: eggDayCounts },
    enoughRecorded: recordedDays.every(count => count >= MIN_RECORDED_DAYS_PER_BLOCK), enoughEggs: eggDayCounts.every(count => count >= MIN_RECORDED_DAYS_PER_BLOCK),
  };
}

const percent = (numerator: bigint, denominator: bigint) => ratioString(numerator * 100n, denominator, 1);
const exact = (numerator: bigint, denominator: bigint): ExactChange => ({ numerator: numerator.toString(), denominator: denominator.toString() });
const notEnough = (rule: TrendFigureRule, currency: string | null, missing: MissingReason[]): TrendFigure =>
  ({ rule, currency, outcome: "NOT_ENOUGH_RECORDS", missing, earlier: null, current: null, change: null, exactChange: null });

/** Evaluates one active batch on the farm date `today`; a closed batch has no current trend and gives null. */
export function evaluateBatchTrends(facts: BatchTrendFacts, today: string): BatchTrendEvaluation | null {
  if (!isCalendarDate(facts.acquiredOn) || !Number.isInteger(facts.startingQuantity) || facts.startingQuantity < 0) throw new FoundationError("INVALID_INPUT");
  for (const entry of facts.entries) assertProductionQuantity(entry);
  for (const cost of facts.feedCosts) { moneyUnits(cost.amount); if (!isCalendarDate(cost.occurredOn) || !/^[A-Z]{3}$/.test(cost.currency)) throw new FoundationError("INVALID_INPUT"); }
  if (facts.status !== "ACTIVE") return null;
  const windows = trendWindows(today), earlier = windowTotals(facts, windows.earlier), current = windowTotals(facts, windows.current);
  const coverage = { earlier: earlier.coverage, current: current.coverage };
  const currencies = [...new Set([...earlier.costs.keys(), ...current.costs.keys()])].sort((a, b) => a.localeCompare(b));

  // A batch too young or too small is reported for that reason alone.
  const shared: MissingReason[] = facts.acquiredOn > windows.earlier.from ? ["BATCH_TOO_YOUNG"]
    : earlier.birdsAtStart < BigInt(MIN_BIRDS) || current.birdsAtStart < BigInt(MIN_BIRDS) ? ["TOO_FEW_BIRDS"] : [];
  const recordedGap: MissingReason[] = earlier.enoughRecorded && current.enoughRecorded ? [] : ["FEW_RECORDED_DAYS"];

  const feed = (currency: string | null): TrendFigure => {
    const costE = currency ? earlier.costs.get(currency) ?? 0n : 0n, costC = currency ? current.costs.get(currency) ?? 0n : 0n;
    const missing: MissingReason[] = shared.length ? shared : [...recordedGap, ...(costE === 0n || costC === 0n ? ["NO_FEED_COST" as const] : [])];
    if (missing.length) return notEnough("FEED_COST_RISING", currency, missing);
    // Cost per bird = cost × 28 ÷ bird-days; the 28 cancels in the change.
    const numerator = costC * earlier.birdDays - costE * current.birdDays, denominator = costE * current.birdDays;
    const raised = numerator * FEED_RISE.denominator >= denominator * FEED_RISE.numerator;
    const perBird = (cost: bigint, birdDays: bigint) => ratioString(cost * BigInt(WINDOW_DAYS), birdDays * MONEY_SCALE, 2);
    return { rule: "FEED_COST_RISING", currency, outcome: raised ? "RAISED" : "NOT_RAISED", missing: [], earlier: perBird(costE, earlier.birdDays), current: perBird(costC, current.birdDays),
      change: percent(numerator, denominator), exactChange: exact(numerator, denominator) };
  };
  const eggs = (): TrendFigure => {
    const missing: MissingReason[] = shared.length ? shared : [...(earlier.enoughEggs && current.enoughEggs ? [] : ["FEW_EGG_DAYS" as const]), ...(earlier.eggs === 0n ? ["NO_EARLIER_EGGS" as const] : [])];
    if (missing.length) return notEnough("EGGS_FALLING", null, missing);
    const numerator = current.eggs * earlier.birdDays - earlier.eggs * current.birdDays, denominator = earlier.eggs * current.birdDays;
    const raised = numerator * EGG_FALL.denominator <= -denominator * EGG_FALL.numerator;
    return { rule: "EGGS_FALLING", currency: null, outcome: raised ? "RAISED" : "NOT_RAISED", missing: [], earlier: percent(earlier.eggs, earlier.birdDays), current: percent(current.eggs, current.birdDays),
      change: percent(numerator, denominator), exactChange: exact(numerator, denominator) };
  };
  const mortality = (): TrendFigure => {
    const missing: MissingReason[] = shared.length ? shared : recordedGap;
    if (missing.length) return notEnough("MORTALITY_RISING", null, missing);
    // Points = 100 × (deathsC ÷ atRiskC − deathsE ÷ atRiskE); at risk is at least MIN_BIRDS here.
    const numerator = 100n * (current.deaths * earlier.atRisk - earlier.deaths * current.atRisk), denominator = current.atRisk * earlier.atRisk;
    const raised = numerator >= denominator * MORTALITY_RISE_POINTS;
    return { rule: "MORTALITY_RISING", currency: null, outcome: raised ? "RAISED" : "NOT_RAISED", missing: [], earlier: percent(earlier.deaths, earlier.atRisk), current: percent(current.deaths, current.atRisk),
      change: ratioString(numerator, denominator, 1), exactChange: exact(numerator, denominator) };
  };

  const feedFigures = currencies.length ? currencies.map(feed) : [feed(null)], eggFigure = eggs(), mortalityFigure = mortality();
  const candidate = (ruleKey: RuleKey, currency: string | null, figures: TrendFigure[]): InsightCandidate =>
    ({ ruleKey, ruleVersion: RULES[ruleKey].version, severity: RULES[ruleKey].severity, batchId: facts.batchId, currency, figures });
  const candidates: InsightCandidate[] = [];
  const eggsRaised = eggFigure.outcome === "RAISED";
  for (const figure of feedFigures) {
    if (figure.outcome !== "RAISED") continue;
    candidates.push(eggsRaised ? candidate("PRODUCTION_FALLING_COSTS_RISING", figure.currency, [figure, eggFigure]) : candidate("FEED_COST_RISING", figure.currency, [figure]));
  }
  if (eggsRaised && !feedFigures.some(figure => figure.outcome === "RAISED")) candidates.push(candidate("EGGS_FALLING", null, [eggFigure]));
  if (mortalityFigure.outcome === "RAISED") candidates.push(candidate("MORTALITY_RISING", null, [mortalityFigure]));
  return { batchId: facts.batchId, label: facts.label, windows, coverage, figures: [...feedFigures, eggFigure, mortalityFigure], candidates };
}
