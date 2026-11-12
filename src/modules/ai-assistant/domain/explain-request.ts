import type { HighestProfitEvidence, Measure } from "./highest-profit";

/**
 * What may leave MyFarm for an explanation (D-P11-003): the question and the calculated figures, with their period,
 * units and currency. Enterprise and season names are the farmer's own words and record IDs identify people and
 * farms, so neither is sent: enterprises go as {E1}, {E2}, and the period as dates. The question is the farmer's
 * text and is sent as data, marked untrusted; nothing in it can change what was retrieved or what may be cited.
 */
export interface ExplainRequest {
  /** Untrusted. Never interpreted as instructions; the explainer may only cite the refs below. */
  question: string;
  tool: HighestProfitEvidence["tool"];
  toolVersion: number;
  basis: HighestProfitEvidence["basis"];
  period: { kind: "SEASON" | "DATES" | "ALL_RECORDS"; from: string | null; to: string | null };
  currency: string | null;
  outcome: HighestProfitEvidence["outcome"];
  enterprises: string[];
  figures: { ref: string; measure: Measure; value: string; currency: string; enterprise: string | null }[];
  enterprisesLeftOut: number;
}

export function explainRequest(question: string, evidence: HighestProfitEvidence): ExplainRequest {
  const period = evidence.period;
  return {
    question,
    tool: evidence.tool,
    toolVersion: evidence.toolVersion,
    basis: evidence.basis,
    period: period.kind === "SEASON" ? { kind: "SEASON", from: period.startDate, to: period.endDate }
      : period.kind === "DATES" ? { kind: "DATES", from: period.from, to: period.to } : { kind: "ALL_RECORDS", from: null, to: null },
    currency: evidence.currency,
    outcome: evidence.outcome,
    enterprises: evidence.enterprises.map(row => row.ref),
    figures: evidence.figures.map(row => ({ ref: row.ref, measure: row.measure, value: row.value, currency: row.currency, enterprise: row.enterpriseRef })),
    enterprisesLeftOut: evidence.enterprisesLeftOut,
  };
}
