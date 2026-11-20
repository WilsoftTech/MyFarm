import { describe, expect, it } from "vitest";
import { assertPendingReview, assertVoiceConfirmation, confirmationPayload } from "@/modules/voice-experience/domain/confirmation";
import { reviewFeedExpense } from "@/modules/voice-experience/domain/expense-review";
const scope = { actorId: crypto.randomUUID(), tenantId: crypto.randomUUID(), farmId: crypto.randomUUID() };
const review = reviewFeedExpense({ kind: "FEED_EXPENSE", totalAmount: "180000", currency: "UGX", bags: 2 }, { requestId: crypto.randomUUID(), categoryId: crypto.randomUUID(), occurredOn: "2026-11-20" });
const now = new Date("2026-11-20T12:00:00Z"), payloadHash = "a".repeat(64);
const state = { ...scope, requestId: review.command.requestId, version: 1, payloadHash, expiresAt: "2026-11-20T12:30:00.000Z", completed: false };
const confirmation = { confirmed: true as const, requestId: review.command.requestId, version: 1, payloadHash };
describe("exact confirmation contract (P12 T004)", () => {
  it("binds every consequential field and bag description to actor, scope and version", () => {
    const base = confirmationPayload(scope, review, 1);
    for (const change of [{ amount: "90000" }, { currency: "USD" }, { occurredOn: "2026-11-21" }, { categoryId: crypto.randomUUID() }, { enterpriseId: crypto.randomUUID() }, { requestId: crypto.randomUUID() }])
      expect(confirmationPayload(scope, { ...review, command: { ...review.command, ...change } }, 1)).not.toBe(base);
    expect(confirmationPayload(scope, { ...review, bags: 3 }, 1)).not.toBe(base);
    expect(confirmationPayload(scope, review, 2)).not.toBe(base);
    for (const key of ["actorId", "tenantId", "farmId"] as const) expect(confirmationPayload({ ...scope, [key]: crypto.randomUUID() }, review, 1)).not.toBe(base);
  });
  it("preserves the T002 canonical representation for already saved draft hashes", () => {
    expect(confirmationPayload(scope, review, 1)).toBe(JSON.stringify({ schemaVersion: 1, tenantId: scope.tenantId, farmId: scope.farmId, actorId: scope.actorId, version: 1, review }));
  });
  it.each(["actorId", "tenantId", "farmId"] as const)("refuses the wrong %s even with the right grant", key => {
    expect(() => assertVoiceConfirmation({ ...scope, [key]: crypto.randomUUID() }, state, confirmation, payloadHash, now)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it("refuses expiry at the exact boundary and completed edits", () => {
    expect(() => assertPendingReview(state.expiresAt, false, new Date(state.expiresAt))).toThrow(expect.objectContaining({ code: "CONFLICT" }));
    expect(() => assertPendingReview(state.expiresAt, true, now)).toThrow();
    expect(() => assertPendingReview("bad", false, now)).toThrow();
    expect(() => assertVoiceConfirmation(scope, state, confirmation, payloadHash, now)).not.toThrow();
  });
  it("replays completed receipts after expiry but rejects a changed payload or version", () => {
    const later = new Date("2026-11-21T12:00:00Z");
    expect(() => assertVoiceConfirmation(scope, { ...state, completed: true }, confirmation, payloadHash, later)).not.toThrow();
    expect(() => assertVoiceConfirmation(scope, { ...state, completed: true }, { ...confirmation, version: 2 }, payloadHash, later)).toThrow();
    expect(() => assertVoiceConfirmation(scope, state, confirmation, "b".repeat(64), now)).toThrow();
  });
});
