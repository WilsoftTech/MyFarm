import type { Answer, AnswerRules } from "./answer";

/**
 * The evidence every assistant tool returns (MYF-P11-R001, R002): what was calculated, for which farm and period, and
 * when. Each tool is read-only and bounded; an answer may cite only the figures and labels here, by ref (answer.ts).
 */
export const TOOL_KEYS = ["HIGHEST_PROFIT", "ASK_RECORDS", "EXPLAIN_PROFIT", "COMPARE_SEASONS", "SUMMARIZE", "UNUSUAL_COSTS", "UPCOMING_TASKS", "FARM_REPORT"] as const;
export type ToolKey = typeof TOOL_KEYS[number];

export interface EvidenceScope { tenantId: string; farmId: string }
/** The view the figures cover. A season's label is the farmer's own words, so it is shown but never sent out. */
export type AssistantPeriod =
  | { kind: "SEASON"; label: string; startDate: string; endDate: string | null }
  | { kind: "DATES"; from: string | null; to: string | null }
  | { kind: "ALL_RECORDS" };

/** Figures are exact decimal strings worked out by MyFarm; money carries its currency and is never combined across currencies. */
export const FIGURE_KINDS = ["MONEY", "COUNT", "PERCENT", "DATE"] as const;
export type FigureKind = typeof FIGURE_KINDS[number];
export interface Figure { ref: string; measure: string; kind: FigureKind; value: string; currency: string | null; subjectRef: string | null }

/** Names an answer can show. Farmer-entered names are never sent to a provider (D-P11-003); only the ref and kind are. */
export const LABEL_KINDS = ["ENTERPRISE", "CATEGORY", "RECORD_KIND", "ACTIVITY", "SEASON", "ALERT", "SUBJECT"] as const;
export type LabelKind = typeof LABEL_KINDS[number];
export interface EvidenceLabel { ref: string; kind: LabelKind; text: string; id: string | null }
/** Each label kind has its own ref letter, so a placeholder reads the same in every tool. */
export const LABEL_PREFIX: Record<LabelKind, string> = { ENTERPRISE: "E", CATEGORY: "C", RECORD_KIND: "K", ACTIVITY: "A", SEASON: "S", ALERT: "R", SUBJECT: "B" };

export const NO_CONCLUSION_REASONS = ["NO_RECORDS", "NO_ENTERPRISE_LINKED", "NOT_A_SEASON", "NO_EARLIER_SEASON", "NOT_IN_BOTH_SEASONS", "NOTHING_CHECKED", "SOURCES_DISAGREE"] as const;
export type NoConclusionReason = typeof NO_CONCLUSION_REASONS[number];
export type Outcome =
  | {
    status: "ANSWERED";
    /** The refs the first FACT must cite: the answer to the question asked. */
    conclusion: string[];
    /** Tool-specific facts the plain answer is built from (refs, flags); never figures themselves. */
    detail: Record<string, string | boolean | string[]>;
  }
  | { status: "NO_CONCLUSION"; reason: NoConclusionReason };

export interface Evidence {
  tool: ToolKey;
  toolVersion: number;
  scope: EvidenceScope;
  /** How money was counted, when the tool counts money. */
  basis: "ACCRUAL" | "CASH" | null;
  /** Null when the tool has its own windows (alerts) or looks forward (tasks). */
  period: AssistantPeriod | null;
  /** When the figures were calculated; they are never read from a stored snapshot (D-P08-008). */
  asOf: string;
  /** The one currency this evidence is about, or null when it has none or several (records list each amount's own). */
  currency: string | null;
  outcome: Outcome;
  figures: Figure[];
  labels: EvidenceLabel[];
  /** Items left out past the tool's limit, so the answer can say the list is not complete. */
  leftOut: number;
  /** Figures two of MyFarm's own calculations disagree on (R003, filled from the farm screen's reconciliation). */
  conflicts: string[];
}

/** Builds figures and labels with stable refs: F1, F2... and E1, C1, A1... in the order added. */
export class EvidenceBuilder {
  readonly figures: Figure[] = [];
  readonly labels: EvidenceLabel[] = [];
  figure(measure: string, kind: FigureKind, value: string, currency: string | null = null, subjectRef: string | null = null): string {
    const ref = "F" + (this.figures.length + 1);
    this.figures.push({ ref, measure, kind, value, currency, subjectRef });
    return ref;
  }
  money(measure: string, value: string, currency: string, subjectRef: string | null = null) { return this.figure(measure, "MONEY", value, currency, subjectRef); }
  /** One label per kind and id (or text, when there is no id), so the same enterprise is one ref throughout. */
  label(kind: LabelKind, text: string, id: string | null = null): string {
    const known = this.labels.find(row => row.kind === kind && (id ? row.id === id : row.text === text && row.id === null));
    if (known) return known.ref;
    const ref = LABEL_PREFIX[kind] + (this.labels.filter(row => row.kind === kind).length + 1);
    this.labels.push({ ref, kind, text, id });
    return ref;
  }
}

/** What an answer to this evidence may cite and must conclude (answer.ts). */
export function answerRules(evidence: Pick<Evidence, "figures" | "labels" | "outcome" | "conflicts">): AnswerRules {
  return {
    figureRefs: evidence.figures.map(row => row.ref),
    labelRefs: evidence.labels.map(row => row.ref),
    conclusion: evidence.outcome.status === "ANSWERED" ? evidence.outcome.conclusion : null,
    conflicts: evidence.conflicts,
  };
}

/** Evidence may only be shown to the farm it was calculated for (two-tenant retrieval, AC001). */
export function belongsTo(evidence: Pick<Evidence, "scope">, scope: EvidenceScope): boolean {
  return evidence.scope.tenantId === scope.tenantId && evidence.scope.farmId === scope.farmId;
}

/**
 * What a plain answer is built from: refs, measures, kinds and the outcome, never names or IDs, so the fake explainer
 * can build it from the explain request alone (it sees exactly what a real provider would).
 */
export interface DraftSource {
  tool: ToolKey;
  outcome: Outcome;
  figures: readonly Pick<Figure, "ref" | "measure" | "kind" | "subjectRef">[];
  labels: readonly { ref: string; kind: LabelKind }[];
  leftOut: number;
  conflicts: readonly string[];
}
export type Draft = (source: DraftSource) => Answer;

/** The figure of one measure about one subject (or about none). */
export const refOf = (source: Pick<DraftSource, "figures">, measure: string, subjectRef: string | null = null) =>
  source.figures.find(row => row.measure === measure && row.subjectRef === subjectRef)?.ref;
export const detailRefs = (outcome: Outcome, key: string): string[] => outcome.status === "ANSWERED" && Array.isArray(outcome.detail[key]) ? outcome.detail[key] as string[] : [];
export const detailFlag = (outcome: Outcome, key: string): boolean => outcome.status === "ANSWERED" && outcome.detail[key] === true;

/** One failed check of the farm screen's own reconciliation (Phase 8, R004): two paths gave different totals. */
export interface SourceDisagreement { currency: string; expected: string; found: string }

/**
 * Contradictory sources (R003). When MyFarm's own checks disagree in this evidence's currency, no money figure in that
 * currency may be stated as a fact: every one becomes a conflict, the two disagreeing totals are added so the answer
 * can say what disagrees, and there is no conclusion. Evidence in another currency is unaffected.
 */
export function withDisagreements(evidence: Evidence, disagreements: readonly SourceDisagreement[]): Evidence {
  const found = disagreements.find(row => row.currency === evidence.currency);
  if (!found || !evidence.currency) return evidence;
  const figures = [...evidence.figures];
  const add = (measure: string, value: string) => { const ref = "F" + (figures.length + 1); figures.push({ ref, measure, kind: "MONEY", value, currency: evidence.currency, subjectRef: null }); return ref; };
  add("CHECK_EXPECTED", found.expected); add("CHECK_FOUND", found.found);
  const conflicts = figures.filter(row => row.kind === "MONEY" && row.currency === evidence.currency).map(row => row.ref);
  return { ...evidence, figures, conflicts, outcome: { status: "NO_CONCLUSION", reason: "SOURCES_DISAGREE" } };
}
