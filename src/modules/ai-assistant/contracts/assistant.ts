import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { dashboardQuerySchema } from "@/modules/analytics-profitability/contracts/profitability";
import { MAX_REFS, MAX_STATEMENT_LENGTH, MAX_STATEMENTS, STATEMENT_KINDS } from "../domain/answer";
import type { ExplainRequest } from "../domain/explain-request";

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
