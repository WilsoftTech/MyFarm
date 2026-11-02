import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { OutboxEntry, SyncStatus } from "./records";

/** Offline architecture state diagram. CONFLICT and FAILED leave only through a new command with a new ID, so they have no direct exit here. */
const TRANSITIONS: Readonly<Record<SyncStatus, readonly SyncStatus[]>> = Object.freeze({
  LOCAL_ONLY: ["PENDING"], PENDING: ["SYNCING"], SYNCING: ["SYNCED", "PENDING", "CONFLICT", "FAILED"], SYNCED: [], CONFLICT: [], FAILED: [],
});
export function assertTransition(from: SyncStatus, to: SyncStatus): void {
  if (!TRANSITIONS[from].includes(to)) throw new FoundationError("CONFLICT");
}
const change = (entry: OutboxEntry, to: SyncStatus, now: Date, fields: Partial<OutboxEntry> = {}): OutboxEntry => {
  assertTransition(entry.syncStatus, to);
  return { ...entry, ...fields, syncStatus: to, updatedAt: now.toISOString(), version: entry.version + 1 };
};

export const SYNC_TIMING = Object.freeze({ leaseMs: 120_000, baseRetryMs: 5_000, maxRetryMs: 900_000, batchSize: 20, keepSyncedDays: 7 });
/** Exponential with jitter, so many phones reconnecting together do not retry in step. random is injected for tests. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(SYNC_TIMING.maxRetryMs, SYNC_TIMING.baseRetryMs * 2 ** Math.min(Math.max(attempt - 1, 0), 20));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

export function startSending(entry: OutboxEntry, now: Date): OutboxEntry {
  return change(entry, "SYNCING", now, { leaseUntil: new Date(now.getTime() + SYNC_TIMING.leaseMs).toISOString() });
}
/** A browser that closed mid-send leaves SYNCING behind. The server's receipt makes the resend safe. */
export function recoverIfAbandoned(entry: OutboxEntry, now: Date): OutboxEntry {
  if (entry.syncStatus !== "SYNCING" || (entry.leaseUntil && Date.parse(entry.leaseUntil) > now.getTime())) return entry;
  return change(entry, "PENDING", now, { leaseUntil: null, nextAttemptAt: null });
}

export const PUSH_OUTCOMES = ["COMMITTED", "RETRYABLE", "CONFLICT", "INVALID", "DENIED"] as const;
export type PushOutcome = { status: "COMMITTED"; result: Record<string, unknown> } | { status: "RETRYABLE"; retryAfterMs?: number } | { status: "CONFLICT"; current?: Record<string, unknown> } | { status: "INVALID" } | { status: "DENIED" };
export const OUTCOME_MESSAGES: Readonly<Record<Exclude<PushOutcome["status"], "COMMITTED">, string>> = Object.freeze({
  RETRYABLE: "Could not reach MyFarm. It will try again.",
  CONFLICT: "This changed elsewhere after you saved it.",
  INVALID: "MyFarm could not accept these details.",
  DENIED: "You no longer have access to this farm.",
});
export function applyOutcome(entry: OutboxEntry, outcome: PushOutcome, now: Date, random: () => number = Math.random): OutboxEntry {
  const finished = { leaseUntil: null, nextAttemptAt: null };
  switch (outcome.status) {
    case "COMMITTED": return change(entry, "SYNCED", now, { ...finished, result: outcome.result, lastError: null });
    case "RETRYABLE": {
      const attemptCount = entry.attemptCount + 1, wait = Math.max(outcome.retryAfterMs ?? 0, retryDelayMs(attemptCount, random));
      return change(entry, "PENDING", now, { attemptCount, leaseUntil: null, nextAttemptAt: new Date(now.getTime() + wait).toISOString(), lastError: OUTCOME_MESSAGES.RETRYABLE });
    }
    case "CONFLICT": return change(entry, "CONFLICT", now, { ...finished, result: outcome.current ?? null, lastError: OUTCOME_MESSAGES.CONFLICT });
    case "INVALID": return change(entry, "FAILED", now, { ...finished, lastError: OUTCOME_MESSAGES.INVALID });
    case "DENIED": return change(entry, "FAILED", now, { ...finished, lastError: OUTCOME_MESSAGES.DENIED });
  }
}

export type ParentState = "NONE" | "READY" | "WAITING" | "BLOCKED";
/** A child goes only after its parent is confirmed. A parent that needs the farmer's attention blocks it without failing it. */
export function parentState(entry: OutboxEntry, entries: ReadonlyMap<string, OutboxEntry>): ParentState {
  if (!entry.dependsOn) return "NONE";
  const parent = entries.get(entry.dependsOn);
  if (!parent || parent.syncStatus === "CONFLICT" || parent.syncStatus === "FAILED") return "BLOCKED";
  return parent.syncStatus === "SYNCED" ? "READY" : "WAITING";
}
/** Oldest first and in dependency order, ready to send now. */
export function readyEntries(entries: readonly OutboxEntry[], now: Date): OutboxEntry[] {
  const byId = new Map(entries.map(row => [row.clientMutationId, row]));
  return entries.filter(row => {
    if (row.syncStatus !== "PENDING" || (row.nextAttemptAt && Date.parse(row.nextAttemptAt) > now.getTime())) return false;
    const parent = parentState(row, byId);
    return parent === "NONE" || parent === "READY";
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientMutationId.localeCompare(b.clientMutationId));
}
/** A parent's confirmed ID, read from what the server returned for it. */
export function parentRecordId(parent: OutboxEntry): string | null {
  const id = parent.result?.recordId ?? parent.result?.activityId;
  return typeof id === "string" ? id : null;
}
/** Sent entries are kept a little so children and the sync center can read them, unless something still depends on them. */
export function isPrunable(entry: OutboxEntry, entries: readonly OutboxEntry[], now: Date): boolean {
  if (entry.syncStatus !== "SYNCED" || now.getTime() - Date.parse(entry.updatedAt) < SYNC_TIMING.keepSyncedDays * 86_400_000) return false;
  return !entries.some(row => row.dependsOn === entry.clientMutationId && row.syncStatus !== "SYNCED");
}
/** Everything that goes when a farmer discards an entry: unsent children cannot be sent without it. */
export function entriesToDiscard(entry: OutboxEntry, entries: readonly OutboxEntry[]): string[] {
  const found = new Set([entry.clientMutationId]);
  for (let changed = true; changed;) {
    changed = false;
    for (const row of entries) if (row.dependsOn && found.has(row.dependsOn) && !found.has(row.clientMutationId)) { found.add(row.clientMutationId); changed = true; }
  }
  return [...found];
}
