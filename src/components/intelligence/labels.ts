import type { MissingReason, TrendFigureRule } from "@/modules/farm-intelligence/domain/batch-trends";
import type { RuleKey, Severity } from "@/modules/farm-intelligence/domain/rules";

/** Plain words for each approved rule (D-P10-002). The figures and dates beside them come from the server unchanged. */
export const ruleTitles: Record<RuleKey, string> = {
  PRODUCTION_FALLING_COSTS_RISING: "Fewer eggs while feed costs more",
  FEED_COST_RISING: "Feed is costing more per bird",
  EGGS_FALLING: "Each bird is laying fewer eggs",
  MORTALITY_RISING: "More birds are dying than before",
};
export const severityLabels: Record<Severity, string> = { WARNING: "Warning", WATCH: "Watch" };
export const figureLabels: Record<TrendFigureRule, string> = {
  FEED_COST_RISING: "Feed cost per bird",
  EGGS_FALLING: "Eggs per 100 birds a day",
  MORTALITY_RISING: "Birds that died",
};
export const missingLabels: Record<MissingReason, string> = {
  BATCH_TOO_YOUNG: "The batch is not yet 8 weeks old here, so there are no two periods to compare.",
  TOO_FEW_BIRDS: "Fewer than 20 birds: a change of one or two birds would look too big.",
  FEW_EGG_DAYS: "Eggs were recorded on fewer than 4 days in at least one week.",
  FEW_RECORDED_DAYS: "The batch has records on fewer than 4 days in at least one week.",
  NO_FEED_COST: "No feed cost is linked to this batch in one of the two 4-week periods.",
  NO_EARLIER_EGGS: "No eggs were recorded in the earlier 4 weeks.",
};
/** A change as the farmer reads it: a sign on rises, "%" for feed and eggs, points for deaths. */
export function changeText(rule: TrendFigureRule, change: string): string {
  const signed = change.startsWith("-") || change === "0" ? change : "+" + change;
  return rule === "MORTALITY_RISING" ? signed + " points" : signed + "%";
}
export function valueText(rule: TrendFigureRule, value: string, currency: string | null): string {
  if (rule === "MORTALITY_RISING") return value + "%";
  return rule === "FEED_COST_RISING" && currency ? value + " " + currency : value;
}
