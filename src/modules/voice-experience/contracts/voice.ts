import { z } from "zod";
import { recordExpenseSchema } from "@/modules/farm-accounting/contracts/accounting";
import { normalizePositiveAmount, normalizeCurrency } from "@/modules/farm-accounting/domain/money";

/** Provider output is an untrusted suggestion, with no IDs, scope, dates or authority to write. */
export const feedExpenseIntentSchema = z.object({
  kind: z.literal("FEED_EXPENSE"),
  totalAmount: z.string().transform((value, context) => {
    const amount = normalizePositiveAmount(value);
    if (amount === null) { context.addIssue({ code: "custom", message: "Review the total amount." }); return z.NEVER; }
    return amount;
  }),
  currency: z.string().transform((value, context) => {
    const currency = normalizeCurrency(value);
    if (currency === null) { context.addIssue({ code: "custom", message: "Choose a currency." }); return z.NEVER; }
    return currency;
  }),
  // Bags are descriptive only. No bag-to-kg conversion or stock movement is inferred.
  bags: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict();
export type FeedExpenseIntent = z.output<typeof feedExpenseIntentSchema>;

/** The farmer selects these fields from the current authorized farm; no guessing from the device clock. */
export const expenseSelectionSchema = recordExpenseSchema.omit({ amount: true, currency: true });
export const voiceReviewSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("EXPENSE"),
  command: recordExpenseSchema,
  bags: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable(),
}).strict();
export type VoiceExpenseReview = z.output<typeof voiceReviewSchema>;

/** Typed confirmation is explicit; a transcript containing "yes" is never a confirmation. */
export const confirmVoiceReviewSchema = z.object({ confirmed: z.literal(true) }).strict();

export interface VoiceIntentAdapter {
  /** Test adapters and future reviewed providers return unknown: the domain validates every field. */
  extract(transcript: string, signal?: AbortSignal): Promise<unknown>;
}
