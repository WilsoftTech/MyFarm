import type { Account } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { acceptRegistrationSchema, registrationDraftFactSchema } from "../contracts/work";

/** Trusted current server facts only. This check neither creates records nor grants access.
 * Persistence must recheck both parties' current access and atomically apply the exact review.
 * Review duration is deliberately not invented here; the approved server expiry is supplied.
 */
export function registrationConfirmation(account: Account, rawDraft: unknown, input: unknown, now: Date): "EXECUTE" | "REPLAY" {
  if (account.status !== "ACTIVE") throw new FoundationError("FORBIDDEN");
  const draft = registrationDraftFactSchema.safeParse(rawDraft), confirmation = acceptRegistrationSchema.safeParse(input);
  if (!draft.success || !confirmation.success || !Number.isFinite(now.getTime())) throw new FoundationError("INVALID_INPUT");
  if (draft.data.targetUserId.toLowerCase() !== account.id.toLowerCase()) throw new FoundationError("FORBIDDEN");
  if (draft.data.discardedAt !== null || draft.data.payloadHash !== confirmation.data.payloadHash) throw new FoundationError("CONFLICT");
  if (draft.data.acceptedFarmId !== null) {
    if (draft.data.version !== confirmation.data.expectedVersion + 1) throw new FoundationError("CONFLICT");
    return "REPLAY";
  }
  if (draft.data.version !== confirmation.data.expectedVersion || now.getTime() >= Date.parse(draft.data.expiresAt)) throw new FoundationError("CONFLICT");
  return "EXECUTE";
}
