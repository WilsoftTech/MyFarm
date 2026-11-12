import type { AssistantProvider, Intent } from "../contracts/assistant";
import type { ExplainRequest } from "../domain/explain-request";
import { draftAnswer } from "../domain/tools";

/**
 * D-P11-002: the stand-in used until the owner chooses an AI provider. It calls no network and costs nothing. Intent
 * comes from plain keywords; the explanation is MyFarm's own plain answer, built from the explain request alone (so
 * it sees exactly what a real provider would, with no names or IDs) and checked like any provider's.
 */
export const FAKE_PROVIDER = "FAKE", FAKE_MODEL = "fake-explainer-1";

/**
 * Plain keyword patterns, tried in order; the first that matches decides. A real provider will be judged on the same
 * question corpus (tests/unit/ai-assistant-intents.test.ts) before farmers see it.
 */
const PATTERNS: readonly [Intent, RegExp][] = [
  ["HIGHEST_PROFIT", /\b(most money|best enterprise|highest (?:profit|income|margin)|which (?:enterprise|farm|crop|business|one) (?:made|earned|did best|pays|is (?:best|most profitable))|most profitable)\b/i],
  ["COMPARE_SEASONS", /\b(compare|comparison|versus|vs\.?|last season|previous season|season before|than last)\b/i],
  ["UNUSUAL_COSTS", /\b(unusual|strange|odd|abnormal|too (?:high|much)|rising|going up|spending too much)\b.*\b(costs?|spend\w*|expenses?)\b|\b(costs?|spend\w*|expenses?)\b.*\b(unusual|strange|abnormal|too (?:high|much)|rising|going up)\b/i],
  ["UPCOMING_TASKS", /\b(tasks?|to ?do|upcoming|due|coming up|scheduled?|activities|what (?:work|should i do) (?:is )?(?:next|this week|today))\b/i],
  ["FARM_REPORT", /\b(report|statement|breakdown)\b/i],
  ["SUMMARIZE", /\b(summary|summari[sz]e|overview|how (?:is|are) (?:my|the|things on the) farm|how am i doing|performance)\b/i],
  ["EXPLAIN_PROFIT", /\b(profit\w*|surplus|margin|earn\w*|make money|made money|money did i make|making money|losing money|in profit|at a loss)\b/i],
  ["ASK_RECORDS", /\b(records?|transactions?|latest (?:sales?|expenses?|entries)|recent (?:sales?|expenses?|entries)|what did i (?:sell|buy|spend|pay)|show me my)\b/i],
  ["AGRONOMY", /\b(plant\w*|spray\w*|fertili[sz]\w*|disease\w*|pests?|vaccin\w*|seeds?|treat\w*|medicine|drugs?|weed\w*|soil|sick|dying|manure|varieties|variety|armyworm|blight)\b/i],
];

export function fakeIntentOf(question: string): Intent {
  return PATTERNS.find(([, pattern]) => pattern.test(question))?.[0] ?? "UNSUPPORTED";
}

export function fakeExplanation(request: ExplainRequest) {
  return {
    output: draftAnswer({ tool: request.tool, outcome: request.outcome, figures: request.figures, labels: request.labels, leftOut: request.leftOut, conflicts: request.conflicts }),
    model: FAKE_MODEL, inputTokens: 0, outputTokens: 0, costEstimateUsd: "0",
  };
}

export const fakeProvider: AssistantProvider = {
  name: FAKE_PROVIDER,
  detector: { detect: async question => ({ intent: fakeIntentOf(question) }) },
  explainer: { explain: async request => fakeExplanation(request) },
};
