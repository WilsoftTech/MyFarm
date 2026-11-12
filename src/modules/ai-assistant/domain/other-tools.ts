import type { CurrencyDashboard } from "@/modules/analytics-profitability/domain/profitability";
import type { Answer, Statement } from "./answer";
import { detailFlag, detailRefs, EvidenceBuilder, refOf, type DraftSource, type Evidence, type EvidenceScope } from "./evidence";
import { leftOutStatement, signedUnits } from "./highest-profit";
import { SURPLUS_MEANING } from "./money-tools";

/** MYF-P11-R002: comparing seasons, money records, unusual costs and upcoming work. Read-only and bounded. */
export const COMPARE_SEASONS_TOOL = Object.freeze({ key: "COMPARE_SEASONS" as const, version: 1 });
export const ASK_RECORDS_TOOL = Object.freeze({ key: "ASK_RECORDS" as const, version: 1 });
export const UNUSUAL_COSTS_TOOL = Object.freeze({ key: "UNUSUAL_COSTS" as const, version: 1 });
export const UPCOMING_TASKS_TOOL = Object.freeze({ key: "UPCOMING_TASKS" as const, version: 1 });

const signed = (value: bigint) => { const size = value < 0n ? -value : value; const fraction = (size % 10_000n).toString().padStart(4, "0").replace(/0+$/, ""); return (value < 0n ? "-" : "") + (size / 10_000n).toString() + (fraction ? "." + fraction : ""); };

// ---- Compare seasons ----------------------------------------------------------------------------------------------

export interface SeasonInput { seasonId: string; label: string; startDate: string; endDate: string | null; status?: "ACTIVE" | "CLOSED" }
/** The season that started most recently before this one; seasons may overlap, so start dates decide (D-P03-002). */
export function earlierSeason<T extends SeasonInput>(seasons: readonly T[], current: SeasonInput): T | null {
  return seasons.filter(row => row.seasonId !== current.seasonId && row.startDate < current.startDate)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || a.seasonId.localeCompare(b.seasonId))[0] ?? null;
}
export interface CompareSeasonsInput {
  scope: EvidenceScope; basis: "ACCRUAL" | "CASH"; asOf: string;
  /** Null when the farm screen shows all records or dates, not one season. */
  current: { season: SeasonInput; currencies: readonly CurrencyDashboard[] } | null;
  earlier: { season: SeasonInput; currencies: readonly CurrencyDashboard[] } | null;
}
export function compareSeasonsEvidence(input: CompareSeasonsInput): Evidence[] {
  const { key, version } = COMPARE_SEASONS_TOOL;
  const base = { tool: key, toolVersion: version, scope: input.scope, basis: input.basis, asOf: input.asOf, conflicts: [], figures: [], labels: [], leftOut: 0 };
  const current = input.current;
  if (!current) return [{ ...base, period: { kind: "ALL_RECORDS" }, currency: null, outcome: { status: "NO_CONCLUSION", reason: "NOT_A_SEASON" } }];
  const period = { kind: "SEASON" as const, label: current.season.label, startDate: current.season.startDate, endDate: current.season.endDate };
  if (!input.earlier) return [{ ...base, period, currency: null, outcome: { status: "NO_CONCLUSION", reason: "NO_EARLIER_SEASON" } }];
  const earlier = input.earlier;
  const codes = [...new Set([...current.currencies, ...earlier.currencies].map(row => row.currency))].sort();
  if (codes.length === 0) return [{ ...base, period, currency: null, outcome: { status: "NO_CONCLUSION", reason: "NO_RECORDS" } }];
  return codes.map(code => {
    const now = current.currencies.find(row => row.currency === code), before = earlier.currencies.find(row => row.currency === code);
    if (!now || !before) return { ...base, period, currency: code, outcome: { status: "NO_CONCLUSION", reason: "NOT_IN_BOTH_SEASONS" } };
    const build = new EvidenceBuilder();
    const s1 = build.label("SEASON", current.season.label, current.season.seasonId), s2 = build.label("SEASON", earlier.season.label, earlier.season.seasonId);
    const surplusNow = build.money("SURPLUS", now.recordedSurplus, code, s1), surplusBefore = build.money("SURPLUS", before.recordedSurplus, code, s2);
    build.money("SURPLUS_CHANGE", signed(signedUnits(now.recordedSurplus) - signedUnits(before.recordedSurplus)), code);
    build.money("REVENUE", now.revenue, code, s1); build.money("REVENUE", before.revenue, code, s2);
    build.money("EXPENSES", now.expenses, code, s1); build.money("EXPENSES", before.expenses, code, s2);
    return { ...base, period, currency: code, figures: build.figures, labels: build.labels, outcome: { status: "ANSWERED", conclusion: [surplusNow, surplusBefore, s1, s2], detail: { seasons: [s1, s2] } } };
  });
}
export function draftCompareSeasonsAnswer(source: DraftSource): Answer {
  const outcome = source.outcome;
  if (outcome.status === "NO_CONCLUSION") {
    const text = { NOT_A_SEASON: "Choose one season under \"Which records\" to compare it with the season before it.", NO_EARLIER_SEASON: "There is no season before {P} on this farm, so there is nothing to compare it with.",
      NOT_IN_BOTH_SEASONS: "Money in this currency was recorded in only one of the two seasons, so MyFarm cannot compare them.", NO_RECORDS: "Neither season has money records, so MyFarm cannot compare them." }[outcome.reason as "NOT_A_SEASON"] ?? "MyFarm cannot compare these seasons.";
    return { statements: [{ kind: "UNCERTAINTY", text, refs: [] }] };
  }
  const [s1, s2] = detailRefs(outcome, "seasons");
  const now = refOf(source, "SURPLUS", s1)!, before = refOf(source, "SURPLUS", s2)!, change = refOf(source, "SURPLUS_CHANGE")!;
  return { statements: [
    { kind: "FACT", text: `The recorded surplus was {${now}} in {${s1}} and {${before}} in {${s2}}: a change of {${change}}.`, refs: [now, before, s1, s2, change] },
    { kind: "FACT", text: `Money earned: {${refOf(source, "REVENUE", s1)}} in {${s1}}, {${refOf(source, "REVENUE", s2)}} in {${s2}}.`, refs: [refOf(source, "REVENUE", s1)!, refOf(source, "REVENUE", s2)!, s1, s2] },
    { kind: "FACT", text: `Money spent: {${refOf(source, "EXPENSES", s1)}} in {${s1}}, {${refOf(source, "EXPENSES", s2)}} in {${s2}}.`, refs: [refOf(source, "EXPENSES", s1)!, refOf(source, "EXPENSES", s2)!, s1, s2] },
    { kind: "UNCERTAINTY", text: "Each season counts only the records linked to it. " + SURPLUS_MEANING, refs: [] },
  ] };
}

// ---- Money records ------------------------------------------------------------------------------------------------

export const MAX_RECORDS = 8;
export interface RecordInput { recordId: string; kind: "EXPENSE" | "INCOME" | "SALE" | "PURCHASE"; categoryId: string; categoryName: string; amount: string; currency: string; occurredOn: string; enterpriseId: string | null; enterpriseName: string | null; status: string }
export const RECORD_KIND_WORDS: Record<RecordInput["kind"], string> = { EXPENSE: "Expense", INCOME: "Income", SALE: "Sale", PURCHASE: "Purchase" };
/** The farm's latest money records (newest first), reversed ones left out; `more` says whether older ones exist. */
export function recordsEvidence(input: { scope: EvidenceScope; asOf: string; records: readonly RecordInput[]; more: boolean }): Evidence[] {
  const { key, version } = ASK_RECORDS_TOOL;
  const posted = input.records.filter(row => row.status === "POSTED");
  const kept = posted.slice(0, MAX_RECORDS);
  const base = { tool: key, toolVersion: version, scope: input.scope, basis: null, period: { kind: "ALL_RECORDS" as const }, asOf: input.asOf, currency: null, conflicts: [], leftOut: posted.length - kept.length + (input.more ? 1 : 0) };
  if (kept.length === 0) return [{ ...base, figures: [], labels: [], outcome: { status: "NO_CONCLUSION", reason: "NO_RECORDS" } }];
  const build = new EvidenceBuilder();
  const items = kept.map(row => {
    const kind = build.label("RECORD_KIND", RECORD_KIND_WORDS[row.kind], row.kind), category = build.label("CATEGORY", row.categoryName, row.categoryId);
    const enterprise = row.enterpriseId && row.enterpriseName ? build.label("ENTERPRISE", row.enterpriseName, row.enterpriseId) : null;
    const amount = build.money("AMOUNT", row.amount, row.currency, category);
    build.figure("DATE", "DATE", row.occurredOn, null, amount);
    return [amount, kind, category, ...(enterprise ? [enterprise] : [])].join("|");
  });
  return [{ ...base, figures: build.figures, labels: build.labels, outcome: { status: "ANSWERED", conclusion: [items[0].split("|")[0]], detail: { items } } }];
}
export function draftRecordsAnswer(source: DraftSource): Answer {
  if (source.outcome.status === "NO_CONCLUSION") return { statements: [{ kind: "UNCERTAINTY", text: "There are no money records on this farm yet, so there is nothing to show.", refs: [] }] };
  const statements: Statement[] = detailRefs(source.outcome, "items").map(item => {
    const [amount, kind, category, enterprise] = item.split("|");
    const date = source.figures.find(row => row.measure === "DATE" && row.subjectRef === amount)!.ref;
    return { kind: "FACT", text: `{${date}}: {${kind}}, {${category}}, {${amount}}${enterprise ? `, for {${enterprise}}` : ""}.`, refs: [amount, date, kind, category, ...(enterprise ? [enterprise] : [])] };
  });
  statements.push(...leftOutStatement(source, "These are your latest records. Older ones are on the farm's money records page."));
  return { statements: [{ kind: "FACT", text: "Your latest money records, newest first:", refs: [statements[0].refs[0]] }, ...statements] };
}

// ---- Unusual costs (the approved Alerts rules, D-P10-002 to D-P10-005) ----------------------------------------------

/** "Unusual" means what the owner already approved for alerts; the assistant adds no threshold of its own. */
export const COST_RULE_TITLES = {
  FEED_COST_RISING: "Feed is costing more per bird",
  PRODUCTION_FALLING_COSTS_RISING: "Fewer eggs while feed costs more",
  LOSS_PER_EGG: "Eggs cost more to produce than they sell for",
  LOSS_PER_BIRD: "Birds cost more to raise than they sell for",
  LOSS_PER_KG: "This crop costs more per kg than it sells for",
} as const;
export type CostRule = keyof typeof COST_RULE_TITLES;
export const MAX_COST_ALERTS = 5;
export type CostAlertInput =
  | { insightId: string; rule: "FEED_COST_RISING" | "PRODUCTION_FALLING_COSTS_RISING"; subject: string; subjectId: string; currency: string; earlier: string; current: string; change: string }
  | { insightId: string; rule: "LOSS_PER_EGG" | "LOSS_PER_BIRD" | "LOSS_PER_KG"; subject: string; subjectId: string; currency: string; costPerUnit: string; pricePerUnit: string };
export function unusualCostsEvidence(input: { scope: EvidenceScope; asOf: string; alerts: readonly CostAlertInput[]; checked: number; notJudged: number }): Evidence[] {
  const { key, version } = UNUSUAL_COSTS_TOOL;
  const base = { tool: key, toolVersion: version, scope: input.scope, basis: null, period: null, asOf: input.asOf, currency: null, conflicts: [] };
  if (input.checked === 0) return [{ ...base, figures: [], labels: [], leftOut: 0, outcome: { status: "NO_CONCLUSION", reason: "NOTHING_CHECKED" } }];
  const build = new EvidenceBuilder();
  const kept = input.alerts.slice(0, MAX_COST_ALERTS);
  const count = build.figure("COST_ALERTS", "COUNT", String(input.alerts.length));
  build.figure("CHECKED", "COUNT", String(input.checked));
  if (input.notJudged > 0) build.figure("NOT_JUDGED", "COUNT", String(input.notJudged));
  const items = kept.map(alert => {
    const rule = build.label("ALERT", COST_RULE_TITLES[alert.rule], alert.rule), subject = build.label("SUBJECT", alert.subject, alert.subjectId);
    if ("change" in alert) return ["TREND", rule, subject, build.money("FEED_COST_BEFORE", alert.earlier, alert.currency, subject), build.money("FEED_COST_NOW", alert.current, alert.currency, subject), build.figure("FEED_COST_CHANGE", "PERCENT", alert.change, null, subject)].join("|");
    return ["LOSS", rule, subject, build.money("COST_PER_UNIT", alert.costPerUnit, alert.currency, subject), build.money("PRICE_PER_UNIT", alert.pricePerUnit, alert.currency, subject)].join("|");
  });
  return [{ ...base, figures: build.figures, labels: build.labels, leftOut: input.alerts.length - kept.length, outcome: { status: "ANSWERED", conclusion: [count], detail: { items, none: input.alerts.length === 0 } } }];
}
export function draftUnusualCostsAnswer(source: DraftSource): Answer {
  if (source.outcome.status === "NO_CONCLUSION") return { statements: [{ kind: "UNCERTAINTY", text: "There is no active poultry batch or crop to check, so MyFarm cannot say whether any cost is unusual.", refs: [] }] };
  const count = refOf(source, "COST_ALERTS")!, checked = refOf(source, "CHECKED")!, notJudged = refOf(source, "NOT_JUDGED");
  const statements: Statement[] = [detailFlag(source.outcome, "none")
    ? { kind: "FACT", text: `No cost alert is open. MyFarm's alert rules checked {${checked}} batches and crops.`, refs: [count, checked] }
    : { kind: "FACT", text: `Cost alerts open on this farm: {${count}}.`, refs: [count] }];
  for (const item of detailRefs(source.outcome, "items")) {
    const [kind, rule, subject, a, b, c] = item.split("|");
    statements.push(kind === "TREND"
      ? { kind: "FACT", text: `{${rule}}, {${subject}}: feed cost per bird went from {${a}} to {${b}}, a change of {${c}}.`, refs: [a, b, c, rule, subject] }
      : { kind: "FACT", text: `{${rule}}, {${subject}}: it cost {${a}} for each one, and each sold for {${b}} on average.`, refs: [a, b, rule, subject] });
  }
  statements.push(...leftOutStatement(source, "Only some of the open cost alerts are listed here; see Alerts for all of them."));
  if (notJudged) statements.push({ kind: "UNCERTAINTY", text: `Cost figures that could not be checked because records are missing: {${notJudged}}. See Alerts for what is missing.`, refs: [notJudged] });
  statements.push({ kind: "UNCERTAINTY", text: "Unusual here means what the farm's alert rules flag; each rule uses its own period, shown on the Alerts page.", refs: [] });
  return { statements };
}

// ---- Upcoming work (Phase 6) --------------------------------------------------------------------------------------

export const MAX_TASKS = 6;
export interface TaskInput { activityId: string; type: string; typeLabel: string; dueOn: string; enterpriseId: string | null; enterpriseName: string | null }
export function upcomingTasksEvidence(input: { scope: EvidenceScope; asOf: string; today: string; due: readonly TaskInput[]; missed: readonly TaskInput[]; moreDue: boolean; moreMissed: boolean }): Evidence[] {
  const { key, version } = UPCOMING_TASKS_TOOL;
  const build = new EvidenceBuilder();
  const item = (task: TaskInput) => {
    const activity = build.label("ACTIVITY", task.typeLabel, task.type), enterprise = task.enterpriseId && task.enterpriseName ? build.label("ENTERPRISE", task.enterpriseName, task.enterpriseId) : null;
    return [build.figure("DUE_ON", "DATE", task.dueOn, null, activity), activity, ...(enterprise ? [enterprise] : [])].join("|");
  };
  const due = input.due.slice(0, MAX_TASKS), missed = input.missed.slice(0, Math.max(0, MAX_TASKS - due.length));
  const today = build.figure("TODAY", "DATE", input.today);
  const dueCount = build.figure("DUE", "COUNT", String(input.due.length) + (input.moreDue ? "+" : ""));
  const dueItems = due.map(item), missedItems = missed.map(item);
  if (input.missed.length) build.figure("MISSED", "COUNT", String(input.missed.length) + (input.moreMissed ? "+" : ""));
  const leftOut = input.due.length - due.length + input.missed.length - missed.length + (input.moreDue || input.moreMissed ? 1 : 0);
  return [{ tool: key, toolVersion: version, scope: input.scope, basis: null, period: { kind: "DATES", from: input.today, to: null }, asOf: input.asOf, currency: null, conflicts: [],
    figures: build.figures, labels: build.labels, leftOut, outcome: { status: "ANSWERED", conclusion: [dueCount, today], detail: { due: dueItems, missed: missedItems } } }];
}
export function draftUpcomingTasksAnswer(source: DraftSource): Answer {
  const due = detailRefs(source.outcome, "due"), missed = detailRefs(source.outcome, "missed");
  const line = (item: string, missedTask: boolean): Statement => {
    const [date, activity, enterprise] = item.split("|");
    return { kind: "FACT", text: missedTask ? `{${activity}}${enterprise ? ` for {${enterprise}}` : ""} was due on {${date}} and is not marked done.` : `{${activity}}${enterprise ? ` for {${enterprise}}` : ""}, due {${date}}.`, refs: [date, activity, ...(enterprise ? [enterprise] : [])] };
  };
  const count = refOf(source, "DUE")!, today = refOf(source, "TODAY")!, missedCount = refOf(source, "MISSED");
  const statements: Statement[] = [{ kind: "FACT", text: `Farm work due from {${today}} and not yet done: {${count}}.`, refs: [count, today] }, ...due.map(item => line(item, false))];
  if (missedCount) statements.push({ kind: "FACT", text: `Work past its date and not marked done: {${missedCount}}.`, refs: [missedCount] }, ...missed.map(item => line(item, true)));
  statements.push(...leftOutStatement(source, "Only the nearest work is listed here; see Activities for the rest."));
  return { statements };
}
