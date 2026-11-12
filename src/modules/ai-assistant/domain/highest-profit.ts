import type { CurrencyDashboard } from "@/modules/analytics-profitability/domain/profitability";
import { moneyUnits } from "@/modules/farm-accounting/domain/money";
import type { Answer, AnswerRules, Statement } from "./answer";

/**
 * MYF-P11-R001, the source example (P0620-P0624): "Which farm made me the most money?" MyFarm's own Phase 8
 * calculation (enterprise gross margin, D-P08-002) decides; this only arranges it as evidence with exact period,
 * scope and result. Currencies are never combined (D-P04-002): each currency is its own evidence and answer.
 */
export const HIGHEST_PROFIT_TOOL = Object.freeze({ key: "HIGHEST_PROFIT" as const, version: 1 });
/** Enterprises carried per currency, highest gross margin first; a farm is not expected to reach it. */
export const MAX_ENTERPRISES = 20;

export interface EvidenceScope { tenantId: string; farmId: string }
/** The view the figures cover. A season's label is the farmer's own words, so it is shown but never sent out. */
export type AssistantPeriod =
  | { kind: "SEASON"; label: string; startDate: string; endDate: string | null }
  | { kind: "DATES"; from: string | null; to: string | null }
  | { kind: "ALL_RECORDS" };

export const MEASURES = ["GROSS_MARGIN", "REVENUE", "DIRECT_COSTS", "NOT_LINKED_REVENUE", "NOT_LINKED_COSTS"] as const;
export type Measure = typeof MEASURES[number];
/** One calculated amount: an exact decimal string (may be negative for a margin) in one currency. */
export interface Figure { ref: string; measure: Measure; value: string; currency: string; enterpriseRef: string | null }
export interface EnterpriseEvidence { ref: string; enterpriseId: string; name: string }

export type HighestProfitOutcome =
  | {
    status: "ANSWERED";
    /** Every enterprise tied for the highest gross margin, in the dashboard's stable order. */
    leaders: string[];
    /** True when even the highest gross margin is zero or less: then no enterprise made money. */
    noProfit: boolean;
  }
  | { status: "NO_CONCLUSION"; reason: "NO_RECORDS" | "NO_ENTERPRISE_LINKED" };

export interface HighestProfitEvidence {
  tool: typeof HIGHEST_PROFIT_TOOL.key;
  toolVersion: number;
  scope: EvidenceScope;
  basis: "ACCRUAL" | "CASH";
  period: AssistantPeriod;
  /** When the figures were calculated; they are never read from a stored snapshot (D-P08-008). */
  asOf: string;
  /** Null only when nothing at all was recorded in the view. */
  currency: string | null;
  outcome: HighestProfitOutcome;
  enterprises: EnterpriseEvidence[];
  figures: Figure[];
  /** Enterprises left out past MAX_ENTERPRISES, so the answer can say the list is not complete. */
  enterprisesLeftOut: number;
}

export interface HighestProfitInput { scope: EvidenceScope; basis: "ACCRUAL" | "CASH"; period: AssistantPeriod; asOf: string; currencies: readonly CurrencyDashboard[] }

/** The evidence for each currency recorded in the view, or one NO_RECORDS evidence when nothing was. */
export function highestProfitEvidence(input: HighestProfitInput): HighestProfitEvidence[] {
  const base = { tool: HIGHEST_PROFIT_TOOL.key, toolVersion: HIGHEST_PROFIT_TOOL.version, scope: input.scope, basis: input.basis, period: input.period, asOf: input.asOf };
  if (input.currencies.length === 0) return [{ ...base, currency: null, outcome: { status: "NO_CONCLUSION", reason: "NO_RECORDS" }, enterprises: [], figures: [], enterprisesLeftOut: 0 }];
  return [...input.currencies].sort((a, b) => a.currency.localeCompare(b.currency)).map(currency => {
    const figures: Figure[] = [], enterprises: EnterpriseEvidence[] = [];
    const figure = (measure: Measure, value: string, enterpriseRef: string | null) => {
      const ref = "F" + (figures.length + 1);
      figures.push({ ref, measure, value, currency: currency.currency, enterpriseRef });
      return ref;
    };
    // The dashboard already orders enterprises by gross margin, highest first, ties by name (D-P08-008).
    const kept = currency.enterprises.slice(0, MAX_ENTERPRISES);
    for (const row of kept) {
      const ref = "E" + (enterprises.length + 1);
      enterprises.push({ ref, enterpriseId: row.enterpriseId, name: row.name });
      figure("GROSS_MARGIN", row.grossMargin, ref);
      figure("REVENUE", row.revenue, ref);
      figure("DIRECT_COSTS", row.directCosts, ref);
    }
    if (moneyUnits(currency.unassigned.revenue) > 0n) figure("NOT_LINKED_REVENUE", currency.unassigned.revenue, null);
    if (moneyUnits(currency.unassigned.costs) > 0n) figure("NOT_LINKED_COSTS", currency.unassigned.costs, null);
    const tops = new Set(currency.topEnterpriseIds);
    const leaders = enterprises.filter(row => tops.has(row.enterpriseId)).map(row => row.ref);
    const outcome: HighestProfitOutcome = kept.length === 0 || leaders.length === 0
      ? { status: "NO_CONCLUSION", reason: "NO_ENTERPRISE_LINKED" }
      : { status: "ANSWERED", leaders, noProfit: !(signedUnits(kept[0].grossMargin) > 0n) };
    return { ...base, currency: currency.currency, outcome, enterprises, figures, enterprisesLeftOut: currency.enterprises.length - kept.length };
  });
}

/** What the plain answer needs: no names or IDs, so the fake explainer can build it from the explain request alone. */
export type DraftSource = Pick<HighestProfitEvidence, "outcome" | "enterprisesLeftOut"> & { figures: readonly Omit<Figure, "currency">[]; enterprises: readonly { ref: string }[] };

const signedUnits = (value: string) => value.startsWith("-") ? -moneyUnits(value.slice(1)) : moneyUnits(value);
const refOf = (evidence: DraftSource, enterpriseRef: string | null, measure: Measure) =>
  evidence.figures.find(row => row.enterpriseRef === enterpriseRef && row.measure === measure)?.ref;

/** What an answer to this evidence may cite and must conclude (see answer.ts). */
export function highestProfitRules(evidence: HighestProfitEvidence): AnswerRules {
  const conclusion = evidence.outcome.status === "ANSWERED" ? [refOf(evidence, evidence.outcome.leaders[0], "GROSS_MARGIN")!, evidence.outcome.leaders[0]] : null;
  return { figureRefs: evidence.figures.map(row => row.ref), enterpriseRefs: evidence.enterprises.map(row => row.ref), conclusion };
}

/** Evidence may only be shown to the farm it was calculated for (two-tenant retrieval, AC001). */
export function belongsTo(evidence: HighestProfitEvidence, scope: EvidenceScope): boolean {
  return evidence.scope.tenantId === scope.tenantId && evidence.scope.farmId === scope.farmId;
}

const GROSS_MARGIN_MEANING = "Gross margin is sales less the costs linked to each enterprise. It is not net profit: costs shared by the farm, depreciation and loans are not taken off.";

/**
 * The plain answer, built only from the evidence. The fake explainer returns it (D-P11-002), and it is shown
 * whenever an explanation fails its checks, so a farmer always gets the exact figures or an honest "cannot say".
 */
export function draftHighestProfitAnswer(evidence: DraftSource): Answer {
  const outcome = evidence.outcome;
  if (outcome.status === "NO_CONCLUSION") {
    const text = outcome.reason === "NO_RECORDS"
      ? "There are no money records for {P}, so MyFarm cannot say which enterprise made the most money."
      : "Money was recorded for {P}, but none of it is linked to an enterprise, so MyFarm cannot compare enterprises.";
    return { statements: [{ kind: "UNCERTAINTY", text, refs: [] }] };
  }
  const [first, ...tied] = outcome.leaders;
  const margin = (ref: string) => refOf(evidence, ref, "GROSS_MARGIN")!;
  const statements: Statement[] = [];
  const names = [first, ...tied].map(ref => "{" + ref + "}").join(" and ");
  if (outcome.noProfit) {
    statements.push({ kind: "FACT", text: `No enterprise made money for {P}. The highest gross margin was {${margin(first)}}, for ${names}.`, refs: [margin(first), first, ...tied.flatMap(ref => [margin(ref), ref])] });
  } else if (tied.length) {
    statements.push({ kind: "FACT", text: `${names} tied for the highest gross margin for {P}: {${margin(first)}} each.`, refs: [margin(first), first, ...tied.flatMap(ref => [margin(ref), ref])] });
  } else {
    statements.push({ kind: "FACT", text: `{${first}} made the most money for {P}: a gross margin of {${margin(first)}}.`, refs: [margin(first), first] });
  }
  const revenue = refOf(evidence, first, "REVENUE")!, costs = refOf(evidence, first, "DIRECT_COSTS")!;
  statements.push({ kind: "FACT", text: `That is {${revenue}} of sales less {${costs}} of costs linked to {${first}}.`, refs: [revenue, costs, first] });
  const next = evidence.enterprises.find(row => !outcome.leaders.includes(row.ref));
  if (next) statements.push({ kind: "FACT", text: `Next was {${next.ref}}, at {${margin(next.ref)}}.`, refs: [margin(next.ref), next.ref] });
  const notLinked = [refOf(evidence, null, "NOT_LINKED_REVENUE"), refOf(evidence, null, "NOT_LINKED_COSTS")].filter((ref): ref is string => !!ref);
  if (notLinked.length) {
    const words = notLinked.map(ref => evidence.figures.find(row => row.ref === ref)!.measure === "NOT_LINKED_REVENUE" ? `{${ref}} of sales` : `{${ref}} of costs`).join(" and ");
    statements.push({ kind: "UNCERTAINTY", text: `Records not linked to any enterprise are left out of this comparison: ${words}.`, refs: notLinked });
  }
  if (evidence.enterprisesLeftOut > 0) statements.push({ kind: "UNCERTAINTY", text: "Only the enterprises with the highest gross margins are listed here.", refs: [] });
  statements.push({ kind: "UNCERTAINTY", text: GROSS_MARGIN_MEANING, refs: [] });
  return { statements };
}
