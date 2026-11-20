import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { executeVoiceDraftSchema, type VoiceDraftConfirmation } from "../contracts/drafts";
import { voiceReviewSchema, type VoiceExpenseReview } from "../contracts/voice";

export interface ConfirmationState extends ProductionWriteScope {
  requestId: string; version: number; payloadHash: string; expiresAt: string; completed: boolean;
}
/** A versioned canonical representation; hashing belongs to the server's cryptographic adapter. */
export function confirmationPayload(scope: ProductionWriteScope, review: VoiceExpenseReview, version: number): string {
  if (!Number.isSafeInteger(version) || version < 1) throw new FoundationError("INVALID_INPUT");
  return JSON.stringify({ schemaVersion: 1, tenantId: scope.tenantId, farmId: scope.farmId, actorId: scope.actorId,
    version, review: voiceReviewSchema.parse(review) });
}
export function assertPendingReview(expiresAt: string, completed: boolean, now: Date) {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry) || !Number.isFinite(now.getTime())) throw new FoundationError("INVALID_INPUT");
  if (completed || expiry <= now.getTime()) throw new FoundationError("CONFLICT");
}
/** A receipt can outlive expiry, but never actor/scope binding or exact payload identity. */
export function assertVoiceConfirmation(scope: ProductionWriteScope, state: ConfirmationState, input: VoiceDraftConfirmation, expectedHash: string, now: Date) {
  if (scope.actorId !== state.actorId || scope.tenantId !== state.tenantId || scope.farmId !== state.farmId) throw new FoundationError("FORBIDDEN");
  const parsed = executeVoiceDraftSchema.safeParse(input);
  if (!parsed.success) throw new FoundationError("INVALID_INPUT");
  if (state.requestId !== parsed.data.requestId.toLowerCase() || state.version !== parsed.data.version || state.payloadHash !== parsed.data.payloadHash || state.payloadHash !== expectedHash) throw new FoundationError("CONFLICT");
  if (!state.completed) assertPendingReview(state.expiresAt, false, now);
}
