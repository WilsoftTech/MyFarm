/**
 * The approved rule catalog (MYF-P10-R001; Q19 answered by D-P10-002, D-P10-004 and D-P10-006). Rules are plain,
 * deterministic code: no LLM or provider is involved (P0598). Every insight records the rule's key and version, so a
 * later change to a threshold is a new version and never rewrites what a farmer was shown.
 */
export const TREND_RULE_KEYS = ["FEED_COST_RISING", "EGGS_FALLING", "MORTALITY_RISING", "PRODUCTION_FALLING_COSTS_RISING"] as const;
/** MYF-P10-R002 threshold warnings (D-P10-003, D-P10-005, D-P10-007). */
export const THRESHOLD_RULE_KEYS = ["HIGH_MORTALITY", "FEED_RUNNING_LOW", "LOSS_PER_EGG", "LOSS_PER_BIRD", "LOSS_PER_KG"] as const;
export const RULE_KEYS = [...TREND_RULE_KEYS, ...THRESHOLD_RULE_KEYS] as const;
export type RuleKey = typeof RULE_KEYS[number];
export type TrendRuleKey = typeof TREND_RULE_KEYS[number];
export const SEVERITIES = ["WARNING", "WATCH"] as const;
export type Severity = typeof SEVERITIES[number];

export interface RuleDefinition {
  key: RuleKey;
  version: number;
  severity: Severity;
  /** The decisions that approved the rule and its numbers. */
  decisions: readonly string[];
  /** The threshold in plain words, shown with every insight. */
  threshold: string;
}

/** Comparison windows (D-P10-002): the last 28 complete farm days against the 28 before them. */
export const WINDOW_DAYS = 28;
/** Coverage (D-P10-004, D-P10-006): each block of 7 days needs records on at least 4 of its days. */
export const BLOCK_DAYS = 7, MIN_RECORDED_DAYS_PER_BLOCK = 4;
/** No insight for a batch with fewer birds than this at the start of either window (D-P10-004). */
export const MIN_BIRDS = 20;

/** Feed cost per bird must rise by at least this fraction (20%). */
export const FEED_RISE = { numerator: 1n, denominator: 5n };
/** Eggs per bird must fall by at least this fraction (10%). */
export const EGG_FALL = { numerator: 1n, denominator: 10n };
/** Mortality must rise by at least this many percentage points. */
export const MORTALITY_RISE_POINTS = 1n;

const TREND = ["D-P10-002", "D-P10-004", "D-P10-006"] as const;
export const RULES: Readonly<Record<RuleKey, RuleDefinition>> = {
  FEED_COST_RISING: { key: "FEED_COST_RISING", version: 1, severity: "WATCH", decisions: TREND, threshold: "Feed cost per bird up 20% or more" },
  EGGS_FALLING: { key: "EGGS_FALLING", version: 1, severity: "WATCH", decisions: TREND, threshold: "Eggs per bird down 10% or more" },
  MORTALITY_RISING: { key: "MORTALITY_RISING", version: 1, severity: "WATCH", decisions: TREND, threshold: "Deaths up 1 percentage point or more" },
  // The source's own example insight (P0580-P0587): feed costs rising while eggs fall. When both rules fire on a
  // batch, this one is raised in their place, with both figures as evidence.
  PRODUCTION_FALLING_COSTS_RISING: { key: "PRODUCTION_FALLING_COSTS_RISING", version: 1, severity: "WARNING", decisions: [...TREND, "P0587"], threshold: "Feed cost per bird up 20% or more while eggs per bird fall 10% or more" },
  // Threshold warnings are always Warnings: a figure is past an explicit limit, not only moving.
  HIGH_MORTALITY: { key: "HIGH_MORTALITY", version: 1, severity: "WARNING", decisions: ["D-P10-003", "D-P10-004"], threshold: "More than 1% of the birds died in the last 7 days" },
  FEED_RUNNING_LOW: { key: "FEED_RUNNING_LOW", version: 1, severity: "WARNING", decisions: ["D-P10-005", "D-P10-007"], threshold: "Feed in stock lasts fewer than 7 days at the last 14 days' use" },
  LOSS_PER_EGG: { key: "LOSS_PER_EGG", version: 1, severity: "WARNING", decisions: ["D-P10-005"], threshold: "Cost per egg in the last 28 days is above the average price per egg sold" },
  LOSS_PER_BIRD: { key: "LOSS_PER_BIRD", version: 1, severity: "WARNING", decisions: ["D-P10-005", "D-P08-006"], threshold: "Cost per bird so far is above the average price per bird sold" },
  LOSS_PER_KG: { key: "LOSS_PER_KG", version: 1, severity: "WARNING", decisions: ["D-P10-005", "D-P08-005"], threshold: "Cost per kg this season is above the average price per kg sold" },
};
