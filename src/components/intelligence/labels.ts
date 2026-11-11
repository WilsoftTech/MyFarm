import type { MissingReason, TrendFigureRule } from "@/modules/farm-intelligence/domain/batch-trends";
import type { RuleKey, Severity } from "@/modules/farm-intelligence/domain/rules";
import type { ThresholdMissing, ThresholdRule } from "@/modules/farm-intelligence/domain/thresholds";

/** Plain words for each approved rule (D-P10-002). The figures and dates beside them come from the server unchanged. */
export const ruleTitles: Record<RuleKey, string> = {
  PRODUCTION_FALLING_COSTS_RISING: "Fewer eggs while feed costs more",
  FEED_COST_RISING: "Feed is costing more per bird",
  EGGS_FALLING: "Each bird is laying fewer eggs",
  MORTALITY_RISING: "More birds are dying than before",
  HIGH_MORTALITY: "Many birds died this week",
  FEED_RUNNING_LOW: "Feed is running low",
  LOSS_PER_EGG: "Eggs cost more to produce than they sell for",
  LOSS_PER_BIRD: "Birds cost more to raise than they sell for",
  LOSS_PER_KG: "This crop costs more per kg than it sells for",
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
export const thresholdFigureLabels: Record<ThresholdRule, string> = {
  HIGH_MORTALITY: "Birds that died in the last 7 days",
  FEED_RUNNING_LOW: "Days of feed left",
  LOSS_PER_EGG: "Cost and price per egg",
  LOSS_PER_BIRD: "Cost and price per bird",
  LOSS_PER_KG: "Cost and price per kg",
};
export const thresholdMissingLabels: Record<ThresholdMissing, string> = {
  BATCH_TOO_YOUNG: "The batch is less than a week old here.",
  TOO_FEW_BIRDS: "Fewer than 20 birds: one or two deaths would look too big.",
  FEW_RECORDED_DAYS: "The batch has records on fewer than 4 of the last 7 days.",
  NO_FEED_ITEM: "No feed item is chosen for this batch. Choose the supply it is fed from.",
  FEED_ITEM_NOT_KG: "The chosen feed item is not counted in kg, so it cannot be compared with feed given in kg.",
  FEW_FEED_DAYS: "Feed given was recorded on fewer than 4 days in one of the last 2 weeks.",
  NO_FEED_USE: "No feed given was recorded in the last 2 weeks.",
  NO_PRODUCTION: "Nothing was produced in this period.",
  NO_SALES: "Nothing was sold in this period in this currency.",
  MORE_THAN_ONE_CROP: "This enterprise has more than one crop cycle this season, so its costs cannot be split between them.",
};
export const lossUnits: Record<Extract<ThresholdRule, "LOSS_PER_EGG" | "LOSS_PER_BIRD" | "LOSS_PER_KG">, { one: string; many: string }> = {
  LOSS_PER_EGG: { one: "egg", many: "eggs" }, LOSS_PER_BIRD: { one: "bird", many: "birds" }, LOSS_PER_KG: { one: "kg", many: "kg" },
};
