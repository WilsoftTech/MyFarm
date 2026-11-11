import { ratioString } from "@/modules/analytics-profitability/domain/metric";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { moneyUnits } from "@/modules/farm-accounting/domain/money";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
import { quantityUnits } from "@/modules/harvest-inventory/domain/harvest";
import { assertProductionQuantity } from "@/modules/harvest-inventory/domain/production";
import { flockByDay, type BatchEntry, type DateWindow, type ExactChange } from "./batch-trends";
import { MIN_BIRDS, MIN_RECORDED_DAYS_PER_BLOCK, RULES, type RuleKey, type Severity } from "./rules";

/**
 * Threshold warnings (MYF-P10-R002; D-P10-003, D-P10-005, D-P10-007). Each compares one figure with an explicit
 * threshold in comparable units; anything that cannot be compared is reported with its reason, never guessed.
 * Exact integer arithmetic, compared before rounding; no clock, no LLM.
 */
export const THRESHOLD_MISSING = ["BATCH_TOO_YOUNG", "TOO_FEW_BIRDS", "FEW_RECORDED_DAYS", "NO_FEED_ITEM", "FEED_ITEM_NOT_KG", "FEW_FEED_DAYS", "NO_FEED_USE", "NO_PRODUCTION", "NO_SALES", "MORE_THAN_ONE_CROP"] as const;
export type ThresholdMissing = typeof THRESHOLD_MISSING[number];
export type ThresholdRule = Extract<RuleKey, "HIGH_MORTALITY" | "FEED_RUNNING_LOW" | "LOSS_PER_EGG" | "LOSS_PER_BIRD" | "LOSS_PER_KG">;
/** The subject a threshold is about: a poultry batch, or a crop cycle for the crop loss rule. */
export interface ThresholdSubject { kind: "BATCH" | "CROP_CYCLE"; id: string; label: string }
export interface ThresholdFigure {
  rule: ThresholdRule;
  currency: string | null;
  outcome: "RAISED" | "NOT_RAISED" | "NOT_ENOUGH_RECORDS";
  missing: ThresholdMissing[];
  window: DateWindow | null;
  /** The inputs as shown to the farmer, by name (for example deaths, birdsAtRisk, costPerUnit, pricePerUnit). */
  values: Record<string, string>;
  /** The figure compared with its threshold, kept exact so a later evaluation can tell whether it got worse. */
  exactValue: ExactChange | null;
}
export interface ThresholdCandidate { ruleKey: ThresholdRule; ruleVersion: number; severity: Severity; subject: ThresholdSubject; currency: string | null; figure: ThresholdFigure }

const SCALE = 1_000_000n, MONEY_SCALE = 10_000n;
/** High mortality (D-P10-003): above this share of birds at risk, in percent, over the last 7 complete days. */
export const HIGH_MORTALITY_PERCENT = 1n, MORTALITY_DAYS = 7;
/** Shortage (D-P10-005): stock covering fewer than this many days at the average use over FEED_USE_DAYS. */
export const MIN_FEED_DAYS = 7n, FEED_USE_DAYS = 14;
/** Loss (D-P10-005): the egg window is the last 28 complete farm days, as the trends. */
export const LOSS_WINDOW_DAYS = 28;

const windowOf = (today: string, days: number): DateWindow => {
  if (!isCalendarDate(today)) throw new FoundationError("INVALID_INPUT");
  return { from: addDays(today, -days), to: addDays(today, -1) };
};
const daysOf = (window: DateWindow, count: number) => Array.from({ length: count }, (_, index) => addDays(window.from, index));
const inWindow = (date: string, window: DateWindow | null) => !window || (date >= window.from && date <= window.to);
const whole = (entry: BatchEntry) => quantityUnits(entry.quantity) / SCALE;
const notEnough = (rule: ThresholdRule, currency: string | null, window: DateWindow | null, missing: ThresholdMissing[]): ThresholdFigure =>
  ({ rule, currency, outcome: "NOT_ENOUGH_RECORDS", missing, window, values: {}, exactValue: null });
const candidateOf = (subject: ThresholdSubject, figure: ThresholdFigure): ThresholdCandidate =>
  ({ ruleKey: figure.rule, ruleVersion: RULES[figure.rule].version, severity: RULES[figure.rule].severity, subject, currency: figure.currency, figure });
function validEntries(entries: readonly BatchEntry[]) { for (const entry of entries) assertProductionQuantity(entry); }

export interface MortalityFacts { batchId: string; label: string; startingQuantity: number; acquiredOn: string; entries: readonly BatchEntry[] }
/** Deaths in the last 7 complete farm days ÷ (birds alive at their start + birds bought in them), raised above 1%. */
export function evaluateHighMortality(facts: MortalityFacts, today: string): ThresholdFigure {
  validEntries(facts.entries);
  if (!isCalendarDate(facts.acquiredOn)) throw new FoundationError("INVALID_INPUT");
  const window = windowOf(today, MORTALITY_DAYS), days = daysOf(window, MORTALITY_DAYS);
  if (facts.acquiredOn > window.from) return notEnough("HIGH_MORTALITY", null, window, ["BATCH_TOO_YOUNG"]);
  const alive = flockByDay(facts, days)[0];
  if (alive < BigInt(MIN_BIRDS)) return notEnough("HIGH_MORTALITY", null, window, ["TOO_FEW_BIRDS"]);
  const recorded = new Set<string>();
  let deaths = 0n, bought = 0n;
  for (const entry of facts.entries) {
    if (!inWindow(entry.occurredOn, window)) continue;
    recorded.add(entry.occurredOn);
    if (entry.type === "MORTALITY") deaths += whole(entry);
    if (entry.type === "PURCHASE") bought += whole(entry);
  }
  if (recorded.size < MIN_RECORDED_DAYS_PER_BLOCK) return notEnough("HIGH_MORTALITY", null, window, ["FEW_RECORDED_DAYS"]);
  const atRisk = alive + bought, raised = deaths * 100n > atRisk * HIGH_MORTALITY_PERCENT;
  return { rule: "HIGH_MORTALITY", currency: null, outcome: raised ? "RAISED" : "NOT_RAISED", missing: [], window,
    values: { deaths: deaths.toString(), birdsAtRisk: atRisk.toString(), rate: ratioString(deaths * 100n, atRisk, 1), recordedDays: String(recorded.size) },
    exactValue: { numerator: (deaths * 100n).toString(), denominator: atRisk.toString() } };
}

export interface FeedStockFacts {
  /** The supply item chosen as this batch's feed (D-P10-007), with its balance over all stores. */
  item: { itemId: string; name: string; unit: string; balance: string } | null;
  /** This batch's own entries, for the feed-given days. */
  entries: readonly BatchEntry[];
  /** Feed given (kg) in the window by every active batch fed from the same item, this one included. */
  sharedUseKg: string;
}
/** Feed in stock ÷ average daily use over the last 14 complete days, raised under 7 days (D-P10-005, D-P10-007). */
export function evaluateFeedStock(facts: FeedStockFacts, today: string): ThresholdFigure {
  validEntries(facts.entries);
  const window = windowOf(today, FEED_USE_DAYS), days = daysOf(window, FEED_USE_DAYS);
  if (!facts.item) return notEnough("FEED_RUNNING_LOW", null, window, ["NO_FEED_ITEM"]);
  if (facts.item.unit !== "KG") return notEnough("FEED_RUNNING_LOW", null, window, ["FEED_ITEM_NOT_KG"]);
  const fed = new Set(facts.entries.filter(entry => entry.type === "FEED" && inWindow(entry.occurredOn, window)).map(entry => entry.occurredOn));
  const weeks = [days.slice(0, 7), days.slice(7)].map(week => week.filter(day => fed.has(day)).length);
  if (weeks.some(count => count < MIN_RECORDED_DAYS_PER_BLOCK)) return notEnough("FEED_RUNNING_LOW", null, window, ["FEW_FEED_DAYS"]);
  const used = quantityUnits(facts.sharedUseKg), balance = /^-/.test(facts.item.balance) ? 0n : quantityUnits(facts.item.balance);
  if (used === 0n) return notEnough("FEED_RUNNING_LOW", null, window, ["NO_FEED_USE"]);
  // Days left = balance ÷ (used ÷ 14) = 14 × balance ÷ used; under 7 days means 14 × balance < 7 × used.
  const daysLeft = { numerator: BigInt(FEED_USE_DAYS) * balance, denominator: used };
  const raised = daysLeft.numerator < MIN_FEED_DAYS * daysLeft.denominator;
  return { rule: "FEED_RUNNING_LOW", currency: null, outcome: raised ? "RAISED" : "NOT_RAISED", missing: [], window,
    values: { itemName: facts.item.name, stockKg: ratioString(balance, SCALE, 2), dailyUseKg: ratioString(used, SCALE * BigInt(FEED_USE_DAYS), 2), daysLeft: ratioString(daysLeft.numerator, daysLeft.denominator, 1), feedDays: weeks.join(", ") },
    exactValue: { numerator: daysLeft.numerator.toString(), denominator: daysLeft.denominator.toString() } };
}

export interface UnitSale { amount: string; currency: string; quantity: string; occurredOn: string }
export interface UnitCost { amount: string; currency: string; occurredOn: string }
export interface UnitLossFacts {
  rule: Extract<ThresholdRule, "LOSS_PER_EGG" | "LOSS_PER_BIRD" | "LOSS_PER_KG">;
  /** Null judges everything recorded so far (a batch's life, a crop's season). */
  window: DateWindow | null;
  /** Units produced in the same span: eggs laid, birds started, or kg kept after recorded loss. */
  produced: string;
  costs: readonly UnitCost[];
  sales: readonly UnitSale[];
  /** A reason the comparison is not possible before any figure (D-P08-010: more than one crop in the enterprise's season). */
  blocked?: ThresholdMissing;
}
/** Cost per unit against the average selling price per unit, per currency; raised when cost is above price (D-P10-005). */
export function evaluateUnitLoss(facts: UnitLossFacts): ThresholdFigure[] {
  for (const row of [...facts.costs, ...facts.sales]) { moneyUnits(row.amount); if (!isCalendarDate(row.occurredOn) || !/^[A-Z]{3}$/.test(row.currency)) throw new FoundationError("INVALID_INPUT"); }
  const produced = quantityUnits(facts.produced);
  const costs = new Map<string, bigint>(), sold = new Map<string, { amount: bigint; quantity: bigint }>();
  for (const cost of facts.costs) if (inWindow(cost.occurredOn, facts.window)) costs.set(cost.currency, (costs.get(cost.currency) ?? 0n) + moneyUnits(cost.amount));
  for (const sale of facts.sales) {
    if (!inWindow(sale.occurredOn, facts.window)) continue;
    const prior = sold.get(sale.currency) ?? { amount: 0n, quantity: 0n };
    sold.set(sale.currency, { amount: prior.amount + moneyUnits(sale.amount), quantity: prior.quantity + quantityUnits(sale.quantity) });
  }
  const currencies = [...new Set([...costs.keys(), ...sold.keys()])].sort((a, b) => a.localeCompare(b));
  if (facts.blocked) return [notEnough(facts.rule, null, facts.window, [facts.blocked])];
  if (currencies.length === 0) return [notEnough(facts.rule, null, facts.window, produced === 0n ? ["NO_PRODUCTION", "NO_SALES"] : ["NO_SALES"])];
  return currencies.map(currency => {
    const cost = costs.get(currency) ?? 0n, sale = sold.get(currency);
    const missing: ThresholdMissing[] = [...(produced === 0n ? ["NO_PRODUCTION" as const] : []), ...(!sale || sale.quantity === 0n ? ["NO_SALES" as const] : [])];
    if (missing.length || !sale) return notEnough(facts.rule, currency, facts.window, missing);
    // cost ÷ produced > amount ÷ quantity, compared across: cost × quantity > amount × produced.
    const left = cost * sale.quantity, right = sale.amount * produced, raised = left > right;
    const perUnit = (money: bigint, units: bigint) => ratioString(money * SCALE, units * MONEY_SCALE, 2);
    return { rule: facts.rule, currency, outcome: raised ? "RAISED" : "NOT_RAISED", missing: [], window: facts.window,
      values: { costs: ratioString(cost, MONEY_SCALE, 2), produced: ratioString(produced, SCALE, 2), costPerUnit: perUnit(cost, produced), sales: ratioString(sale.amount, MONEY_SCALE, 2), sold: ratioString(sale.quantity, SCALE, 2), pricePerUnit: perUnit(sale.amount, sale.quantity) },
      // How far cost runs above price, as cost ÷ price; a bigger ratio is worse.
      exactValue: right === 0n ? null : { numerator: left.toString(), denominator: right.toString() } };
  });
}

export function thresholdCandidates(subject: ThresholdSubject, figures: readonly ThresholdFigure[]): ThresholdCandidate[] {
  return figures.filter(figure => figure.outcome === "RAISED").map(figure => candidateOf(subject, figure));
}
export const lossWindow = (today: string) => windowOf(today, LOSS_WINDOW_DAYS);
