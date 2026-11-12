import type { Evidence, Figure, LabelKind, Outcome, ToolKey } from "./evidence";

/**
 * What may leave MyFarm for an explanation (D-P11-003): the question and the calculated figures, with their periods,
 * units and currencies. Names (enterprises, seasons, batches, categories) are the farmer's own words or identify
 * them, and record IDs identify people and farms, so neither is sent: each goes as its ref and kind ({E1}, ENTERPRISE).
 * The question is the farmer's text and is sent as data, marked untrusted; nothing in it can change what was
 * retrieved or what may be cited.
 */
export interface ExplainRequest {
  /** Untrusted. Never interpreted as instructions; the explainer may only cite the refs below. */
  question: string;
  tool: ToolKey;
  toolVersion: number;
  basis: Evidence["basis"];
  period: { kind: "SEASON" | "DATES" | "ALL_RECORDS"; from: string | null; to: string | null } | null;
  currency: string | null;
  outcome: Outcome;
  labels: { ref: string; kind: LabelKind }[];
  figures: Pick<Figure, "ref" | "measure" | "kind" | "value" | "currency" | "subjectRef">[];
  leftOut: number;
  conflicts: string[];
}

export function explainRequest(question: string, evidence: Evidence): ExplainRequest {
  const period = evidence.period;
  return {
    question,
    tool: evidence.tool,
    toolVersion: evidence.toolVersion,
    basis: evidence.basis,
    period: !period ? null : period.kind === "SEASON" ? { kind: "SEASON", from: period.startDate, to: period.endDate }
      : period.kind === "DATES" ? { kind: "DATES", from: period.from, to: period.to } : { kind: "ALL_RECORDS", from: null, to: null },
    currency: evidence.currency,
    outcome: evidence.outcome,
    labels: evidence.labels.map(row => ({ ref: row.ref, kind: row.kind })),
    figures: evidence.figures.map(row => ({ ref: row.ref, measure: row.measure, kind: row.kind, value: row.value, currency: row.currency, subjectRef: row.subjectRef })),
    leftOut: evidence.leftOut,
    conflicts: evidence.conflicts,
  };
}
