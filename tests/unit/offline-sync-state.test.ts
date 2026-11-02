import { describe, expect, it } from "vitest";
import { newOutboxEntry } from "@/modules/offline-first/domain/commands";
import { SYNC_STATUSES, UNSENT_STATUSES, type OutboxEntry, type SyncStatus } from "@/modules/offline-first/domain/records";
import { SYNC_TIMING, applyOutcome, assertTransition, entriesToDiscard, isPrunable, parentRecordId, parentState, readyEntries, recoverIfAbandoned, retryDelayMs, startSending } from "@/modules/offline-first/domain/sync-state";

const now = new Date("2026-11-03T09:00:00.000Z");
const later = (ms: number) => new Date(now.getTime() + ms);
const entry = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({ ...newOutboxEntry({ clientMutationId: crypto.randomUUID(), deviceId: "device", farmId: "farm", operation: "RECORD_EXPENSE", payload: {} }, now), ...overrides });
const sending = (overrides: Partial<OutboxEntry> = {}) => startSending(entry(overrides), now);

describe("MYF-P07-AC003 sync states", () => {
  it("keeps the source's six states, all but SYNCED counting as unsent", () => {
    expect([...SYNC_STATUSES]).toEqual(["LOCAL_ONLY", "PENDING", "SYNCING", "SYNCED", "CONFLICT", "FAILED"]);
    expect(SYNC_STATUSES.filter(status => !UNSENT_STATUSES.includes(status))).toEqual(["SYNCED"]);
  });
  const allowed: [SyncStatus, SyncStatus][] = [["LOCAL_ONLY", "PENDING"], ["PENDING", "SYNCING"], ["SYNCING", "SYNCED"], ["SYNCING", "PENDING"], ["SYNCING", "CONFLICT"], ["SYNCING", "FAILED"]];
  it("allows only the designed moves", () => {
    for (const from of SYNC_STATUSES) for (const to of SYNC_STATUSES) {
      const expected = allowed.some(([a, b]) => a === from && b === to);
      if (expected) expect(() => assertTransition(from, to)).not.toThrow();
      else expect(() => assertTransition(from, to)).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    }
  });
  it("bumps the version and timestamp on every move", () => {
    const row = startSending(entry(), later(5_000));
    expect(row).toMatchObject({ syncStatus: "SYNCING", version: 2, updatedAt: later(5_000).toISOString(), leaseUntil: later(5_000 + SYNC_TIMING.leaseMs).toISOString() });
  });
});

describe("MYF-P07-AC003 outcomes", () => {
  it("confirms and keeps the server's IDs for children", () => {
    expect(applyOutcome(sending(), { status: "COMMITTED", result: { recordId: "r" } }, now)).toMatchObject({ syncStatus: "SYNCED", result: { recordId: "r" }, leaseUntil: null, lastError: null });
  });
  it("retries transient failures later, counting attempts", () => {
    const row = applyOutcome(sending(), { status: "RETRYABLE" }, now, () => 1);
    expect(row).toMatchObject({ syncStatus: "PENDING", attemptCount: 1, leaseUntil: null, nextAttemptAt: later(5_000).toISOString() });
    expect(applyOutcome(startSending(row, now), { status: "RETRYABLE" }, now, () => 1).attemptCount).toBe(2);
  });
  it("honors a longer wait from the server", () => {
    expect(applyOutcome(sending(), { status: "RETRYABLE", retryAfterMs: 60_000 }, now, () => 1).nextAttemptAt).toBe(later(60_000).toISOString());
  });
  it("marks a stale version for the farmer's review, with the current record", () => {
    expect(applyOutcome(sending({ baseVersion: 1 }), { status: "CONFLICT", current: { version: 2 } }, now)).toMatchObject({ syncStatus: "CONFLICT", result: { version: 2 }, lastError: expect.stringContaining("changed elsewhere") });
  });
  it("retains permanently refused entries with their details for repair", () => {
    const payload = { amount: "5" };
    expect(applyOutcome(sending({ payload }), { status: "INVALID" }, now)).toMatchObject({ syncStatus: "FAILED", payload, lastError: expect.stringContaining("could not accept") });
    expect(applyOutcome(sending({ payload }), { status: "DENIED" }, now)).toMatchObject({ syncStatus: "FAILED", payload, lastError: expect.stringContaining("no longer have access") });
  });
  it("cannot apply an outcome to an entry that is not being sent", () => {
    expect(() => applyOutcome(entry(), { status: "COMMITTED", result: {} }, now)).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
    expect(() => applyOutcome(applyOutcome(sending(), { status: "COMMITTED", result: {} }, now), { status: "RETRYABLE" }, now)).toThrowError(expect.objectContaining({ code: "CONFLICT" }));
  });
});

describe("retry timing", () => {
  it("doubles from 5 seconds with jitter in the upper half", () => {
    expect(retryDelayMs(1, () => 0)).toBe(2_500);
    expect(retryDelayMs(1, () => 1)).toBe(5_000);
    expect(retryDelayMs(2, () => 1)).toBe(10_000);
    expect(retryDelayMs(4, () => 1)).toBe(40_000);
  });
  it("stops growing at 15 minutes, even after many attempts", () => {
    expect(retryDelayMs(30, () => 1)).toBe(SYNC_TIMING.maxRetryMs);
    expect(retryDelayMs(10_000, () => 1)).toBe(SYNC_TIMING.maxRetryMs);
    expect(retryDelayMs(0, () => 1)).toBe(SYNC_TIMING.baseRetryMs);
  });
});

describe("MYF-P07-AC003 crash during SYNCING", () => {
  it("returns an abandoned send to the queue only after its lease ends", () => {
    const row = sending();
    expect(recoverIfAbandoned(row, later(SYNC_TIMING.leaseMs - 1))).toBe(row);
    expect(recoverIfAbandoned(row, later(SYNC_TIMING.leaseMs))).toMatchObject({ syncStatus: "PENDING", leaseUntil: null, nextAttemptAt: null, attemptCount: 0 });
  });
  it("leaves other states alone", () => {
    const pending = entry();
    expect(recoverIfAbandoned(pending, later(SYNC_TIMING.leaseMs * 2))).toBe(pending);
  });
});

describe("MYF-P07-AC003 ordering and dependencies", () => {
  const at = (minutes: number) => later(minutes * 60_000).toISOString();
  const synced = (overrides: Partial<OutboxEntry> = {}) => applyOutcome(sending(overrides), { status: "COMMITTED", result: { activityId: "a1" } }, now);
  it("sends oldest first and skips anything not yet due", () => {
    const newer = entry({ createdAt: at(2) }), older = entry({ createdAt: at(1) }), waiting = entry({ createdAt: at(0), nextAttemptAt: at(5) });
    expect(readyEntries([newer, older, waiting], now).map(row => row.clientMutationId)).toEqual([older.clientMutationId, newer.clientMutationId]);
    expect(readyEntries([waiting], later(5 * 60_000))).toHaveLength(1);
  });
  it("holds a child until its parent is confirmed, even if it is older", () => {
    const parent = entry({ createdAt: at(5) }), child = entry({ createdAt: at(1), dependsOn: parent.clientMutationId });
    expect(readyEntries([child, parent], now).map(row => row.clientMutationId)).toEqual([parent.clientMutationId]);
    const done = synced({ clientMutationId: parent.clientMutationId });
    expect(readyEntries([child, done], now).map(row => row.clientMutationId)).toEqual([child.clientMutationId]);
    expect(parentRecordId(done)).toBe("a1");
    expect(parentRecordId(entry())).toBeNull();
  });
  it("blocks a child when its parent needs attention or is missing, without failing it", () => {
    const failed = applyOutcome(sending(), { status: "INVALID" }, now), conflict = applyOutcome(sending(), { status: "CONFLICT" }, now);
    const child = (parent: string) => entry({ dependsOn: parent });
    expect(parentState(child(failed.clientMutationId), new Map([[failed.clientMutationId, failed]]))).toBe("BLOCKED");
    expect(parentState(child(conflict.clientMutationId), new Map([[conflict.clientMutationId, conflict]]))).toBe("BLOCKED");
    expect(parentState(child("gone"), new Map())).toBe("BLOCKED");
    expect(parentState(entry(), new Map())).toBe("NONE");
    const orphan = child("gone");
    expect(readyEntries([orphan], now)).toEqual([]);
    expect(orphan.syncStatus).toBe("PENDING");
  });
  it("prunes old sent entries only when nothing still needs them", () => {
    const parent = synced(), child = entry({ dependsOn: parent.clientMutationId }), old = later(SYNC_TIMING.keepSyncedDays * 86_400_000);
    expect(isPrunable(parent, [parent], later(1_000))).toBe(false);
    expect(isPrunable(parent, [parent], old)).toBe(true);
    expect(isPrunable(parent, [parent, child], old)).toBe(false);
    expect(isPrunable(entry(), [], old)).toBe(false);
  });
  it("discards an entry together with its whole chain of children", () => {
    const a = entry(), b = entry({ dependsOn: a.clientMutationId }), c = entry({ dependsOn: b.clientMutationId }), other = entry();
    expect(entriesToDiscard(a, [a, b, c, other]).sort()).toEqual([a, b, c].map(row => row.clientMutationId).sort());
    expect(entriesToDiscard(other, [a, b, c, other])).toEqual([other.clientMutationId]);
  });
});
