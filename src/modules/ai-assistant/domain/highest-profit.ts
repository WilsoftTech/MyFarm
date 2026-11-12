import type { CurrencyDashboard } from "@/modules/analytics-profitability/domain/profitability";
import { moneyUnits } from "@/modules/farm-accounting/domain/money";
import type { Answer, Statement } from "./answer";
import { detailFlag, detailRefs, EvidenceBuilder, refOf, type AssistantPeriod, type DraftSource, type Evidence, type EvidenceScope } from "./evidence";

export type { AssistantPeriod, EvidenceScope } from "./evidence";

/**
 * MYF-P11-R001, the source example (P0620-P0624): "Which farm made me the most money?" MyFarm's own Phase 8
 * calculation (enterprise gross margin, D-P08-002; confirmed as the meaning of "most money", D-P11-006) decides; this
 * only arranges it as evidence with exact period, scope and result. Each currency is its own evidence (D-P04-002).
 */
export const HIGHEST_PROFIT_TOOL = Object.freeze({ key: "HIGHEST_PROFIT" as const, version: 1 });
/** Enterprises carried per currency, highest gross margin first; a farm is not expected to reach it. */
export const MAX_ENTERPRISES = 20;

export interface MoneyViewInput { scope: EvidenceScope; basis: "ACCRUAL" | "CASH"; period: AssistantPeriod; asOf: string; currencies: readonly CurrencyDashboard[] }

export const signedUnits = (value: string) => value.startsWith("-") ? -moneyUnits(value.slice(1)) : moneyUnits(value);
/** The shared base of one money evidence per currency in the view. */
export const moneyBase = (input: MoneyViewInput, tool: Evidence["tool"], version: number) =>
  ({ tool, toolVersion: version, scope: input.scope, basis: input.basis, period: input.period, asOf: input.asOf, conflicts: [] as string[] });
export const noRecords = (input: MoneyViewInput, tool: Evidence["tool"], version: number): Evidence =>
  ({ ...moneyBase(input, tool, version), currency: null, outcome: { status: "NO_CONCLUSION", reason: "NO_RECORDS" }, figures: [], labels: [], leftOut: 0 });
export const byCurrency = (input: MoneyViewInput) => [...input.currencies].sort((a, b) => a.currency.localeCompare(b.currency));

/** Each enterprise's gross margin, revenue and direct costs, highest margin first (the dashboard's own order). */
export function enterpriseFigures(build: EvidenceBuilder, currency: CurrencyDashboard, measures: readonly ("GROSS_MARGIN" | "REVENUE" | "DIRECT_COSTS")[] = ["GROSS_MARGIN", "REVENUE", "DIRECT_COSTS"], limit = MAX_ENTERPRISES) {
  const kept = currency.enterprises.slice(0, limit);
  const refs = kept.map(row => {
    const ref = build.label("ENTERPRISE", row.name, row.enterpriseId);
    const values = { GROSS_MARGIN: row.grossMargin, REVENUE: row.revenue, DIRECT_COSTS: row.directCosts };
    for (const measure of measures) build.money(measure, values[measure], currency.currency, ref);
    return ref;
  });
  return { kept, refs, leftOut: currency.enterprises.length - kept.length };
}

/** The evidence for each currency recorded in the view, or one NO_RECORDS evidence when nothing was. */
export function highestProfitEvidence(input: MoneyViewInput): Evidence[] {
  const { key, version } = HIGHEST_PROFIT_TOOL;
  if (input.currencies.length === 0) return [noRecords(input, key, version)];
  return byCurrency(input).map(currency => {
    const build = new EvidenceBuilder();
    const { kept, refs, leftOut } = enterpriseFigures(build, currency);
    if (moneyUnits(currency.unassigned.revenue) > 0n) build.money("NOT_LINKED_REVENUE", currency.unassigned.revenue, currency.currency);
    if (moneyUnits(currency.unassigned.costs) > 0n) build.money("NOT_LINKED_COSTS", currency.unassigned.costs, currency.currency);
    const tops = new Set(currency.topEnterpriseIds);
    const leaders = refs.filter((_, index) => tops.has(kept[index].enterpriseId));
    const outcome: Evidence["outcome"] = leaders.length === 0
      ? { status: "NO_CONCLUSION", reason: "NO_ENTERPRISE_LINKED" }
      : { status: "ANSWERED", conclusion: [refOf(build, "GROSS_MARGIN", leaders[0])!, leaders[0]], detail: { leaders, noProfit: !(signedUnits(kept[0].grossMargin) > 0n) } };
    return { ...moneyBase(input, key, version), currency: currency.currency, outcome, figures: build.figures, labels: build.labels, leftOut };
  });
}

export const GROSS_MARGIN_MEANING = "Gross margin is sales less the costs linked to each enterprise. It is not net profit: costs shared by the farm, depreciation and loans are not taken off.";

/** Records linked to no enterprise, when there are any. */
export function notLinkedStatement(source: DraftSource): Statement[] {
  const refs = [refOf(source, "NOT_LINKED_REVENUE"), refOf(source, "NOT_LINKED_COSTS")].filter((ref): ref is string => !!ref);
  if (!refs.length) return [];
  const words = refs.map(ref => source.figures.find(row => row.ref === ref)!.measure === "NOT_LINKED_REVENUE" ? `{${ref}} of sales` : `{${ref}} of costs`).join(" and ");
  return [{ kind: "UNCERTAINTY", text: `Records not linked to any enterprise are left out of this comparison: ${words}.`, refs }];
}
export const leftOutStatement = (source: DraftSource, text: string): Statement[] => source.leftOut > 0 ? [{ kind: "UNCERTAINTY", text, refs: [] }] : [];

/**
 * The plain answer, built only from the evidence. The fake explainer returns it (D-P11-002), and it is shown
 * whenever an explanation fails its checks, so a farmer always gets the exact figures or an honest "cannot say".
 */
export function draftHighestProfitAnswer(source: DraftSource): Answer {
  const outcome = source.outcome;
  if (outcome.status === "NO_CONCLUSION") {
    const text = outcome.reason === "NO_RECORDS"
      ? "There are no money records for {P}, so MyFarm cannot say which enterprise made the most money."
      : "Money was recorded for {P}, but none of it is linked to an enterprise, so MyFarm cannot compare enterprises.";
    return { statements: [{ kind: "UNCERTAINTY", text, refs: [] }] };
  }
  const [first, ...tied] = detailRefs(outcome, "leaders");
  const margin = (ref: string) => refOf(source, "GROSS_MARGIN", ref)!;
  const statements: Statement[] = [];
  const names = [first, ...tied].map(ref => "{" + ref + "}").join(" and ");
  if (detailFlag(outcome, "noProfit")) {
    statements.push({ kind: "FACT", text: `No enterprise made money for {P}. The highest gross margin was {${margin(first)}}, for ${names}.`, refs: [margin(first), first, ...tied.flatMap(ref => [margin(ref), ref])] });
  } else if (tied.length) {
    statements.push({ kind: "FACT", text: `${names} tied for the highest gross margin for {P}: {${margin(first)}} each.`, refs: [margin(first), first, ...tied.flatMap(ref => [margin(ref), ref])] });
  } else {
    statements.push({ kind: "FACT", text: `{${first}} made the most money for {P}: a gross margin of {${margin(first)}}.`, refs: [margin(first), first] });
  }
  const revenue = refOf(source, "REVENUE", first)!, costs = refOf(source, "DIRECT_COSTS", first)!;
  statements.push({ kind: "FACT", text: `That is {${revenue}} of sales less {${costs}} of costs linked to {${first}}.`, refs: [revenue, costs, first] });
  const leaders = new Set([first, ...tied]);
  const next = source.labels.find(row => row.kind === "ENTERPRISE" && !leaders.has(row.ref));
  if (next) statements.push({ kind: "FACT", text: `Next was {${next.ref}}, at {${margin(next.ref)}}.`, refs: [margin(next.ref), next.ref] });
  statements.push(...notLinkedStatement(source), ...leftOutStatement(source, "Only the enterprises with the highest gross margins are listed here."));
  statements.push({ kind: "UNCERTAINTY", text: GROSS_MARGIN_MEANING, refs: [] });
  return { statements };
}
