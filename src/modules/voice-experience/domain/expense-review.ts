import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { expenseSelectionSchema, feedExpenseIntentSchema, voiceReviewSchema, type VoiceExpenseReview } from "../contracts/voice";

/** Pure review construction: no persistence, provider invocation, stock or financial write. */
export function reviewFeedExpense(intent: unknown, selection: unknown): VoiceExpenseReview {
  const extracted = feedExpenseIntentSchema.safeParse(intent);
  const selected = expenseSelectionSchema.safeParse(selection);
  if (!extracted.success || !selected.success) throw new FoundationError("INVALID_INPUT");
  return voiceReviewSchema.parse({
    schemaVersion: 1,
    kind: "EXPENSE",
    command: { ...selected.data, amount: extracted.data.totalAmount, currency: extracted.data.currency },
    bags: extracted.data.bags,
  });
}
