import { pushCommandSchema, type PushResponse } from "../contracts/commands";
import { type OutboxEntry } from "../domain/records";
import { SYNC_TIMING, applyOutcome, isPrunable, parentRecordId, readyEntries, recoverIfAbandoned, startSending, type PushOutcome } from "../domain/sync-state";
import type { LocalDatabase } from "./local-database";
import { pullCachedData } from "./pull";

export type SyncResult = "DONE" | "OFFLINE" | "SIGNED_OUT" | "BUSY";
const toCommand = (row: OutboxEntry) => pushCommandSchema.parse({ clientMutationId: row.clientMutationId, deviceId: row.deviceId, farmId: row.farmId, operation: row.operation, payload: row.payload, baseVersion: row.baseVersion, createdAt: row.createdAt });
const isPhoto = (row: OutboxEntry) => row.operation === "ATTACH_PHOTO";

/** force is the farmer pressing Send now, which skips any retry wait. */
async function recover(db: LocalDatabase, now: Date, force: boolean) {
  await db.transaction("rw", db.outbox, async () => {
    const rows = await db.outbox.toArray();
    for (const row of rows) {
      const next = recoverIfAbandoned(row, now);
      if (force && next.syncStatus === "PENDING" && next.nextAttemptAt) await db.outbox.put({ ...next, nextAttemptAt: null });
      else if (next !== row) await db.outbox.put(next);
    }
    await db.outbox.bulkDelete(rows.filter(row => isPrunable(row, rows, now)).map(row => row.clientMutationId));
  });
}
/** Takes the send lease in one transaction, re-reading first so another tab's claim is respected. */
async function claim(db: LocalDatabase, rows: OutboxEntry[]): Promise<OutboxEntry[]> {
  return db.transaction("rw", db.outbox, async () => {
    const claimed: OutboxEntry[] = [];
    for (const row of rows) {
      const current = await db.outbox.get(row.clientMutationId);
      if (current?.syncStatus !== "PENDING") continue;
      const next = startSending(current, new Date());
      await db.outbox.put(next);
      claimed.push(next);
    }
    return claimed;
  });
}
async function settle(db: LocalDatabase, outcomes: { row: OutboxEntry; outcome: PushOutcome }[]) {
  await db.transaction("rw", db.outbox, db.photos, async () => {
    const now = new Date();
    for (const { row, outcome } of outcomes) {
      await db.outbox.put(applyOutcome(row, outcome, now));
      // The server holds the photo now; the phone's copy only takes up scarce space.
      if (isPhoto(row) && outcome.status === "COMMITTED") await db.photos.where("clientMutationId").equals(row.clientMutationId).delete();
    }
  });
}
function outcomeFor(status: number): PushOutcome | "SIGNED_OUT" {
  if (status === 401) return "SIGNED_OUT";
  if (status === 409) return { status: "CONFLICT" };
  if (status === 400 || status === 413) return { status: "INVALID" };
  if (status === 403) return { status: "DENIED" };
  return { status: "RETRYABLE" };
}
async function sendBatch(db: LocalDatabase, rows: OutboxEntry[]): Promise<"OK" | "OFFLINE" | "SIGNED_OUT"> {
  const claimed = await claim(db, rows);
  if (claimed.length === 0) return "OK";
  let response: Response;
  try { response = await fetch("/api/v1/sync/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ commands: claimed.map(toCommand) }) }); }
  catch { await settle(db, claimed.map(row => ({ row, outcome: { status: "RETRYABLE" } }))); return "OFFLINE"; }
  if (!response.ok) {
    const failure = outcomeFor(response.status);
    // A whole-batch refusal says nothing about each entry, so all stay queued rather than being marked as refused.
    await settle(db, claimed.map(row => ({ row, outcome: { status: "RETRYABLE" } })));
    return failure === "SIGNED_OUT" ? "SIGNED_OUT" : "OFFLINE";
  }
  let results: PushResponse["results"];
  try { results = (await response.json() as PushResponse).results; }
  catch { await settle(db, claimed.map(row => ({ row, outcome: { status: "RETRYABLE" } }))); return "OFFLINE"; }
  const byId = new Map(results.map(result => [result.clientMutationId, result.outcome]));
  await settle(db, claimed.map(row => ({ row, outcome: byId.get(row.clientMutationId) ?? { status: "RETRYABLE" } })));
  return "OK";
}
async function sendPhoto(db: LocalDatabase, row: OutboxEntry, all: Map<string, OutboxEntry>): Promise<"OK" | "OFFLINE" | "SIGNED_OUT"> {
  const [claimed] = await claim(db, [row]);
  if (!claimed) return "OK";
  const photo = await db.photos.where("clientMutationId").equals(row.clientMutationId).first();
  const parent = row.dependsOn ? all.get(row.dependsOn) : undefined;
  const recordId = typeof row.payload.recordId === "string" ? row.payload.recordId : parent ? parentRecordId(parent) : null;
  // Browser storage can lose the bytes on its own; the entry stays for the farmer to see rather than retrying forever.
  if (!photo || !recordId) { await settle(db, [{ row: claimed, outcome: { status: "INVALID" } }]); return "OK"; }
  const form = new FormData();
  form.set("requestId", row.clientMutationId); form.set("target", String(row.payload.target)); form.set("recordId", recordId); form.set("sha256", photo.sha256);
  form.set("photo", photo.blob);
  let response: Response;
  try { response = await fetch("/api/v1/farms/" + row.farmId + "/photos", { method: "POST", body: form }); }
  catch { await settle(db, [{ row: claimed, outcome: { status: "RETRYABLE" } }]); return "OFFLINE"; }
  if (response.ok) { await settle(db, [{ row: claimed, outcome: { status: "COMMITTED", result: { photoId: row.clientMutationId } } }]); return "OK"; }
  const failure = outcomeFor(response.status);
  await settle(db, [{ row: claimed, outcome: failure === "SIGNED_OUT" ? { status: "RETRYABLE" } : failure }]);
  return failure === "SIGNED_OUT" ? "SIGNED_OUT" : failure.status === "RETRYABLE" ? "OFFLINE" : "OK";
}
async function run(db: LocalDatabase, keepGoing: () => boolean, force: boolean): Promise<SyncResult> {
  await recover(db, new Date(), force);
  for (;;) {
    if (!keepGoing()) return "DONE";
    const all = await db.outbox.toArray();
    const ready = readyEntries(all, new Date());
    if (ready.length === 0) break;
    const commands = ready.filter(row => !isPhoto(row)).slice(0, SYNC_TIMING.batchSize);
    const photo = commands.length === 0 ? ready.find(isPhoto) : undefined;
    const sent = photo ? await sendPhoto(db, photo, new Map(all.map(row => [row.clientMutationId, row]))) : await sendBatch(db, commands);
    if (sent !== "OK") return sent;
  }
  const pulled = await pullCachedData(db, keepGoing);
  return pulled === "SIGNED_OUT" ? "SIGNED_OUT" : pulled === "OFFLINE" ? "OFFLINE" : "DONE";
}
/** One sender per account across tabs. Leases and server receipts still protect a browser without this API. */
export async function syncNow(db: LocalDatabase, keepGoing: () => boolean = () => true, force = false): Promise<SyncResult> {
  if (!navigator.locks) return run(db, keepGoing, force);
  return navigator.locks.request("sync:" + db.name, { ifAvailable: true }, lock => lock ? run(db, keepGoing, force) : "BUSY");
}
