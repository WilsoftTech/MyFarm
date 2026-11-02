import { checkOfflineCommand } from "../contracts/commands";
import { newOutboxEntry, type OfflineOperation } from "../domain/commands";
import type { OutboxEntry } from "../domain/records";
import { entriesToDiscard } from "../domain/sync-state";
import type { EnqueueResult } from "./outbox";
import { deviceId, type LocalDatabase } from "./local-database";

/** Removes an entry and everything waiting on it, with their photos, in one step. */
export async function discardEntry(db: LocalDatabase, entry: OutboxEntry): Promise<void> {
  await db.transaction("rw", db.outbox, db.photos, async () => {
    const ids = entriesToDiscard(entry, await db.outbox.toArray());
    await db.outbox.bulkDelete(ids);
    await db.photos.where("clientMutationId").anyOf(ids).delete();
  });
}
/** A corrected intent is a new command with a new ID, so a key is never reused for changed details. Waiting children move to it. */
export async function replaceEntry(db: LocalDatabase, prior: OutboxEntry, input: Record<string, unknown>, baseVersion: number | null = prior.baseVersion): Promise<EnqueueResult> {
  const clientMutationId = crypto.randomUUID();
  const checked = checkOfflineCommand(prior.operation as OfflineOperation, clientMutationId, input);
  if (!checked.ok) return { status: "INVALID", errors: checked.errors };
  const device = await deviceId(db);
  await db.transaction("rw", db.outbox, async () => {
    await db.outbox.add(newOutboxEntry({ clientMutationId, deviceId: device, farmId: prior.farmId, operation: prior.operation as OfflineOperation, payload: checked.payload, baseVersion, dependsOn: prior.dependsOn }, new Date()));
    await db.outbox.where("dependsOn").equals(prior.clientMutationId).modify({ dependsOn: clientMutationId });
    await db.outbox.delete(prior.clientMutationId);
  });
  return { status: "SAVED", clientMutationId };
}
/** D-P07-005: readable text the farmer can keep. Photos are left out because of their size, and the screen says so. */
export function unsentCopy(entries: readonly OutboxEntry[], farmNames: ReadonlyMap<string, string>, now: Date): string {
  return JSON.stringify({ note: "MyFarm entries not yet sent. This file is not encrypted. Photos are not included.", createdAt: now.toISOString(),
    entries: entries.map(row => ({ farm: farmNames.get(row.farmId) ?? row.farmId, what: row.operation, savedAt: row.createdAt, status: row.syncStatus, problem: row.lastError, details: row.payload })) }, null, 2);
}
