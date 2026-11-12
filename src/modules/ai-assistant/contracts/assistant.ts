import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { dashboardQuerySchema } from "@/modules/analytics-profitability/contracts/profitability";
import { MAX_REFS, MAX_STATEMENT_LENGTH, MAX_STATEMENTS, STATEMENT_KINDS } from "../domain/answer";
import type { ExplainRequest } from "../domain/explain-request";
import type { ShownAnswer, StoredAnswers } from "../domain/exchange";

export const MAX_QUESTION_LENGTH = 500;

/**
 * A farmer's question (MYF-P11-R001). Strict: tenant, farm and actor are never accepted from the client; the server
 * derives them from current membership. The view uses the farm screen's own filters, so answers match that screen.
 */
export const askQuestionSchema = z.object({
  requestId: idSchema,
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  view: dashboardQuerySchema.optional(),
}).strict();
export type AskQuestion = z.output<typeof askQuestionSchema>;

/**
 * What intent detection may return: an intent and nothing else. A detector (an AI, later) that adds a farm, tenant,
 * period or any other field is refused, so a question cannot widen or move the scope (fake scope, AC001).
 * AGRONOMY questions get the referral, not advice (D-P11-005).
 */
export const INTENTS = ["HIGHEST_PROFIT", "AGRONOMY", "UNSUPPORTED"] as const;
export const detectedIntentSchema = z.object({ intent: z.enum(INTENTS) }).strict();
export type DetectedIntent = z.output<typeof detectedIntentSchema>;

/** What an explainer may return. Strict and bounded; answer.ts then checks every placeholder and claim. */
export const explainedAnswerSchema = z.object({
  statements: z.array(z.object({
    kind: z.enum(STATEMENT_KINDS),
    text: z.string().max(MAX_STATEMENT_LENGTH),
    refs: z.array(z.string().max(4)).max(MAX_REFS),
  }).strict()).min(1).max(MAX_STATEMENTS),
}).strict();

/**
 * Provider ports. Outputs are unknown on purpose: whatever comes back is untrusted and validated. They receive no
 * database access, no SQL and no way to write (P11 section I); only the request object below.
 */
export interface IntentDetector { detect(question: string): Promise<unknown> }
export interface AnswerExplainer { explain(request: ExplainRequest): Promise<unknown> }
/** The provider behind both ports, recorded with every question (D-P11-002: FAKE until the owner chooses one). */
export interface AssistantProvider { name: string; detector: IntentDetector; explainer: AnswerExplainer }

/** What an explainer call returns: its answer (checked separately) and what it cost (D-P11-004). */
export const explainerResultSchema = z.object({
  output: z.unknown(),
  model: z.string().min(1).max(100),
  inputTokens: z.number().int().min(0).max(10_000_000),
  outputTokens: z.number().int().min(0).max(10_000_000),
  costEstimateUsd: z.string().regex(/^\d{1,14}(\.\d{1,6})?$/),
}).strict();
export type ExplainerResult = z.output<typeof explainerResultSchema>;

export interface AssistantScope { tenantId: string; farmId: string; actorId: string }
/** A question as its asker sees it: never another person's, and never one past its 90 days. */
export interface AssistantExchange { questionId: string; question: string; intent: Intent; askedAt: string; keptUntil: string; answers: ShownAnswer[] }
export type Intent = typeof INTENTS[number];
export interface AssistantUsageRecord { provider: string; model: string | null; calls: number; inputTokens: number; outputTokens: number; costEstimateUsd: string }
/** The most questions listed at once, newest first. */
export const MAX_LISTED_QUESTIONS = 20;

/** Write and read port. Every method constrains tenant, farm AND the asking person. */
export interface AssistantRepository {
  byRequest(scope: AssistantScope, requestId: string): Promise<AssistantExchange | null>;
  /** Keeps the question once per request ID, removes the person's expired questions, and logs the cost of a new one. */
  record(scope: AssistantScope, input: { requestId: string; question: string; intent: Intent; answers: StoredAnswers; provider: string; model: string | null; usage: AssistantUsageRecord | null }): Promise<AssistantExchange>;
  list(scope: AssistantScope, limit: number): Promise<AssistantExchange[]>;
  /** True when the person's own question was deleted. */
  remove(scope: AssistantScope, questionId: string): Promise<boolean>;
}
