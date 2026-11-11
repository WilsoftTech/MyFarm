import type { BatchTrendEvaluation, ExactChange, InsightCandidate, TrendFigureRule } from "./batch-trends";
import type { ThresholdRule } from "./thresholds";
import type { RuleKey } from "./rules";

/**
 * Repeats (D-P10-004): the same rule on the same batch is not raised again while one is open; after acknowledgement
 * it comes back only if the figure gets worse. Engineering reading, recorded in the T001 report: an insight whose
 * condition is judged and no longer holds is CLEARED, so a problem that returns later is raised afresh rather than
 * hidden forever behind an old acknowledgement. Not enough records changes nothing: the app cannot tell.
 */
export const INSIGHT_STATUSES = ["OPEN", "ACKNOWLEDGED", "CLEARED"] as const;
export type InsightStatus = typeof INSIGHT_STATUSES[number];
export interface StoredFigure { rule: TrendFigureRule | ThresholdRule; exactChange: ExactChange | null }
/** The most recent insight for one subject: a rule on a batch, in one currency for feed cost. */
export interface LatestInsight { status: InsightStatus; figures: readonly StoredFigure[] }
export type InsightAction = "CREATE" | "CLEAR" | "NONE";

/** What one evaluation says about one subject: raised, or judged and not raised, or not judged. */
export interface SubjectOutcome { ruleKey: RuleKey; batchId: string; currency: string | null; judged: boolean; candidate: InsightCandidate | null }
/** What the repeat rule needs from any outcome, trend or threshold. */
export interface RepeatOutcome { judged: boolean; candidate: { figures: readonly StoredFigure[] } | null }

const COMPONENTS: Record<InsightCandidate["ruleKey"], readonly TrendFigureRule[]> = {
  FEED_COST_RISING: ["FEED_COST_RISING"], EGGS_FALLING: ["EGGS_FALLING"], MORTALITY_RISING: ["MORTALITY_RISING"],
  PRODUCTION_FALLING_COSTS_RISING: ["FEED_COST_RISING", "EGGS_FALLING"],
};

/** Every subject the evaluation can speak about, with or without a candidate. */
export function subjectOutcomes(evaluation: BatchTrendEvaluation): SubjectOutcome[] {
  const figure = (rule: TrendFigureRule, currency: string | null) => evaluation.figures.find(item => item.rule === rule && (rule !== "FEED_COST_RISING" || item.currency === currency));
  const feedCurrencies = evaluation.figures.filter(item => item.rule === "FEED_COST_RISING").map(item => item.currency);
  const subjects: { ruleKey: keyof typeof COMPONENTS; currency: string | null }[] = [
    ...feedCurrencies.flatMap(currency => [{ ruleKey: "FEED_COST_RISING" as const, currency }, { ruleKey: "PRODUCTION_FALLING_COSTS_RISING" as const, currency }]),
    { ruleKey: "EGGS_FALLING", currency: null }, { ruleKey: "MORTALITY_RISING", currency: null },
  ];
  return subjects.map(({ ruleKey, currency }) => {
    const parts = COMPONENTS[ruleKey].map(rule => figure(rule, currency));
    const judged = parts.every(part => part !== undefined && part.outcome !== "NOT_ENOUGH_RECORDS");
    const candidate = evaluation.candidates.find(item => item.ruleKey === ruleKey && item.currency === currency) ?? null;
    return { ruleKey, batchId: evaluation.batchId, currency, judged, candidate };
  });
}

/** a/b compared with c/d, both denominators above zero. */
function compare(a: ExactChange, b: ExactChange): number {
  const left = BigInt(a.numerator) * BigInt(b.denominator), right = BigInt(b.numerator) * BigInt(a.denominator);
  return left === right ? 0 : left > right ? 1 : -1;
}
/** A lower figure is worse for these: eggs per bird and days of feed left. For every other figure a higher one is worse. */
const LOWER_IS_WORSE = new Set<StoredFigure["rule"]>(["EGGS_FALLING", "FEED_RUNNING_LOW"]);
/** Worse means further past the threshold than when the farmer acknowledged it. */
export function isWorse(previous: readonly StoredFigure[], next: readonly StoredFigure[]): boolean {
  return next.some(figure => {
    const before = previous.find(item => item.rule === figure.rule)?.exactChange;
    if (!figure.exactChange || !before) return false;
    const direction = compare(figure.exactChange, before);
    return LOWER_IS_WORSE.has(figure.rule) ? direction < 0 : direction > 0;
  });
}

export function decideInsight(latest: LatestInsight | null, outcome: RepeatOutcome): InsightAction {
  const live = latest && latest.status !== "CLEARED" ? latest : null;
  if (!outcome.judged) return "NONE";
  if (!outcome.candidate) return live ? "CLEAR" : "NONE";
  if (!live) return "CREATE";
  if (live.status === "OPEN") return "NONE";
  return isWorse(live.figures, outcome.candidate.figures) ? "CREATE" : "NONE";
}
