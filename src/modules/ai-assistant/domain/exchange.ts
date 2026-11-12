import { answerParts, type AnswerProblem, type ShownStatement, type Statement } from "./answer";
import { HIGHEST_PROFIT_TOOL, type AssistantPeriod, type HighestProfitEvidence, type Measure } from "./highest-profit";
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
  evidence: HighestProfitEvidence | null;
  statements: Statement[];
  /** EXPLAINER when the explanation passed every check; PLAIN when MyFarm's own answer was shown instead. */
  source: "EXPLAINER" | "PLAIN";
  explainer: ExplainerOutcome;
  problems: ExplanationProblem[];
}
export interface StoredAnswers { answersVersion: 1; answers: StoredAnswer[] }

/** Questions MyFarm cannot answer yet get this, never a guess. */
export const UNSUPPORTED_ANSWER = "MyFarm can answer one question so far: which enterprise made the most money. Ask that in your own words, and choose the season or dates on the farm screen first.";

/** The answer for a question that needs no farm figures: crop or animal advice (D-P11-005), or one not supported yet. */
export function plainAnswer(intent: "AGRONOMY" | "UNSUPPORTED"): StoredAnswer {
  return { evidence: null, statements: [{ kind: "UNCERTAINTY", text: intent === "AGRONOMY" ? AGRONOMY_REFERRAL : UNSUPPORTED_ANSWER, refs: [] }], source: "PLAIN", explainer: "NOT_ASKED", problems: [] };
}

/** What fills a placeholder; the screen formats amounts and dates. */
export type ShownValue =
  | { kind: "MONEY"; amount: string; currency: string; measure: Measure }
  | { kind: "ENTERPRISE"; name: string }
  | { kind: "PERIOD"; period: AssistantPeriod };

export interface ShownAnswer {
  source: StoredAnswer["source"];
  /** Null for a referral or an unsupported question, which rest on no figures. */
  provenance: { tool: typeof HIGHEST_PROFIT_TOOL.key; toolVersion: number; basis: HighestProfitEvidence["basis"]; period: AssistantPeriod; asOf: string; currency: string | null } | null;
  statements: ShownStatement[];
  values: Record<string, ShownValue>;
}

export function shownAnswer(stored: StoredAnswer): ShownAnswer {
  const evidence = stored.evidence;
  const values: Record<string, ShownValue> = {};
  if (evidence) {
    values.P = { kind: "PERIOD", period: evidence.period };
    for (const figure of evidence.figures) values[figure.ref] = { kind: "MONEY", amount: figure.value, currency: figure.currency, measure: figure.measure };
    for (const enterprise of evidence.enterprises) values[enterprise.ref] = { kind: "ENTERPRISE", name: enterprise.name };
  }
  return {
    source: stored.source,
    provenance: evidence ? { tool: evidence.tool, toolVersion: evidence.toolVersion, basis: evidence.basis, period: evidence.period, asOf: evidence.asOf, currency: evidence.currency } : null,
    statements: answerParts({ statements: stored.statements }),
    values,
  };
}
