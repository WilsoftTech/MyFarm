import { answerParts, type AnswerProblem, type ShownStatement, type Statement } from "./answer";
import type { AssistantPeriod, Evidence, FigureKind, LabelKind, ToolKey } from "./evidence";
import { AGRONOMY_REFERRAL } from "./policy";

/**
 * What is kept for each question (D-P11-003) and how it is shown. The evidence is kept with the answer, so the answer
 * can always be traced to the exact figures, period and time it was calculated from (R002 provenance).
 */
export const EXPLAINER_OUTCOMES = ["USED", "REFUSED", "UNAVAILABLE", "NOT_ASKED"] as const;
export type ExplainerOutcome = typeof EXPLAINER_OUTCOMES[number];
/** An explanation that did not even have the right shape. */
export type ExplanationProblem = AnswerProblem | "MALFORMED";

export interface StoredAnswer {
  evidence: Evidence | null;
  statements: Statement[];
  /** EXPLAINER when the explanation passed every check; PLAIN when MyFarm's own answer was shown instead. */
  source: "EXPLAINER" | "PLAIN";
  explainer: ExplainerOutcome;
  problems: ExplanationProblem[];
}
export interface StoredAnswers { answersVersion: 1; answers: StoredAnswer[] }

/** Questions MyFarm cannot answer get this, never a guess. */
export const UNSUPPORTED_ANSWER = "MyFarm can answer questions about this farm's own records: your latest money records, the surplus, which enterprise made the most money, how this season compares with the one before, a summary, a farm report, unusual costs and work coming up. Ask one of those in your own words.";

/** The answer for a question that needs no farm figures: crop or animal advice (D-P11-005), or one not supported. */
export function plainAnswer(intent: "AGRONOMY" | "UNSUPPORTED"): StoredAnswer {
  return { evidence: null, statements: [{ kind: "UNCERTAINTY", text: intent === "AGRONOMY" ? AGRONOMY_REFERRAL : UNSUPPORTED_ANSWER, refs: [] }], source: "PLAIN", explainer: "NOT_ASKED", problems: [] };
}

/** What fills a placeholder; the screen formats amounts and dates. */
export type ShownValue =
  | { kind: Exclude<FigureKind, "MONEY">; value: string; measure: string }
  | { kind: "MONEY"; amount: string; currency: string; measure: string }
  | { kind: "LABEL"; labelKind: LabelKind; text: string }
  | { kind: "PERIOD"; period: AssistantPeriod };

export interface ShownAnswer {
  source: StoredAnswer["source"];
  /** Null for a referral or an unsupported question, which rest on no figures. */
  provenance: { tool: ToolKey; toolVersion: number; basis: Evidence["basis"]; period: AssistantPeriod | null; asOf: string; currency: string | null } | null;
  statements: ShownStatement[];
  values: Record<string, ShownValue>;
  /** Figures MyFarm's own calculations disagree on (R003); the screen marks them. */
  conflicts: string[];
}

export function shownAnswer(stored: StoredAnswer): ShownAnswer {
  const evidence = stored.evidence;
  const values: Record<string, ShownValue> = {};
  if (evidence) {
    if (evidence.period) values.P = { kind: "PERIOD", period: evidence.period };
    for (const figure of evidence.figures) values[figure.ref] = figure.kind === "MONEY" ? { kind: "MONEY", amount: figure.value, currency: figure.currency ?? "", measure: figure.measure } : { kind: figure.kind, value: figure.value, measure: figure.measure };
    for (const label of evidence.labels) values[label.ref] = { kind: "LABEL", labelKind: label.kind, text: label.text };
  }
  return {
    source: stored.source,
    provenance: evidence ? { tool: evidence.tool, toolVersion: evidence.toolVersion, basis: evidence.basis, period: evidence.period, asOf: evidence.asOf, currency: evidence.currency } : null,
    statements: answerParts({ statements: stored.statements }),
    values,
    conflicts: evidence?.conflicts ?? [],
  };
}
