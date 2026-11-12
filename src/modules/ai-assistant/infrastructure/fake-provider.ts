import type { AssistantProvider } from "../contracts/assistant";
import type { ExplainRequest } from "../domain/explain-request";
import { draftHighestProfitAnswer } from "../domain/highest-profit";

/**
 * D-P11-002: the stand-in used until the owner chooses an AI provider. It calls no network and costs nothing. Intent
 * comes from plain keywords; the explanation is MyFarm's own plain answer, built from the explain request alone (so
 * it sees exactly what a real provider would, with no names or IDs) and checked like any provider's.
 */
export const FAKE_PROVIDER = "FAKE", FAKE_MODEL = "fake-explainer-1";

const MONEY = /\b(most money|profit\w*|margin|earn\w*|made (?:me )?(?:the )?most|best enterprise|highest income|which (?:enterprise|farm|crop|business) (?:made|did best|pays))\b/i;
const ADVICE = /\b(plant\w*|spray\w*|fertili[sz]\w*|disease\w*|pests?|vaccin\w*|seeds?|treat\w*|medicine|drugs?|weed\w*|soil|sick|dying|manure|varieties|variety)\b/i;

export function fakeIntentOf(question: string): "HIGHEST_PROFIT" | "AGRONOMY" | "UNSUPPORTED" {
  if (MONEY.test(question)) return "HIGHEST_PROFIT";
  if (ADVICE.test(question)) return "AGRONOMY";
  return "UNSUPPORTED";
}

export function fakeExplanation(request: ExplainRequest) {
  return {
    output: draftHighestProfitAnswer({ outcome: request.outcome, figures: request.figures, enterprises: request.enterprises.map(ref => ({ ref })), enterprisesLeftOut: request.enterprisesLeftOut }),
    model: FAKE_MODEL, inputTokens: 0, outputTokens: 0, costEstimateUsd: "0",
  };
}

export const fakeProvider: AssistantProvider = {
  name: FAKE_PROVIDER,
  detector: { detect: async question => ({ intent: fakeIntentOf(question) }) },
  explainer: { explain: async request => fakeExplanation(request) },
};
