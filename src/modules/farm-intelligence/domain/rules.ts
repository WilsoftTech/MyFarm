/**
 * The approved rule catalog (MYF-P10-R001; Q19 answered by D-P10-002, D-P10-004 and D-P10-006). Rules are plain,
 * deterministic code: no LLM or provider is involved (P0598). Every insight records the rule's key and version, so a
 * later change to a threshold is a new version and never rewrites what a farmer was shown.
 */
export const RULE_KEYS = ["FEED_COST_RISING", "EGGS_FALLING", "MORTALITY_RISING", "PRODUCTION_FALLING_COSTS_RISING"] as const;
export type RuleKey = typeof RULE_KEYS[number];
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
};
