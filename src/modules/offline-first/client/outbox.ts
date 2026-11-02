import { checkOfflineCommand } from "../contracts/commands";
import { newOutboxEntry, type OfflineOperation, type PhotoTarget } from "../domain/commands";
import type { LocalSaveFailure } from "../domain/storage";
import { deviceId, type LocalDatabase } from "./local-database";
import { saveLocally } from "./storage-status";

export type EnqueueResult = { status: "SAVED"; clientMutationId: string } | { status: "INVALID"; errors: Record<string, string> } | { status: "NOT_SAVED"; reason: LocalSaveFailure };

/** Success is reported only after the IndexedDB transaction commits, so a farmer is never told an unsaved entry was kept. */
export async function enqueueCommand(db: LocalDatabase, operation: OfflineOperation, farmId: string, input: Record<string, unknown>, options: { baseVersion?: number; dependsOn?: string } = {}): Promise<EnqueueResult> {
  const clientMutationId = crypto.randomUUID();
  const checked = checkOfflineCommand(operation, clientMutationId, input);
  if (!checked.ok) return { status: "INVALID", errors: checked.errors };
  const saved = await saveLocally(db, async () => {
    const device = await deviceId(db);
    await db.outbox.add(newOutboxEntry({ clientMutationId, deviceId: device, farmId, operation, payload: checked.payload, baseVersion: options.baseVersion, dependsOn: options.dependsOn }, new Date()));
    return clientMutationId;
  });
  return saved.saved ? { status: "SAVED", clientMutationId } : { status: "NOT_SAVED", reason: saved.reason };
}

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join("");
/** The photo and its entry commit together, so a queued photo always has its bytes and metadata. */
export async function enqueuePhoto(db: LocalDatabase, farmId: string, blob: Blob, target: PhotoTarget, parent: { recordId: string } | { parentMutationId: string }): Promise<EnqueueResult> {
  const clientMutationId = crypto.randomUUID(), photoId = clientMutationId;
  const checked = checkOfflineCommand("ATTACH_PHOTO", clientMutationId, { photoId, target, ...parent });
  if (!checked.ok) return { status: "INVALID", errors: checked.errors };
  const sha256 = hex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  const saved = await saveLocally(db, async () => {
    const device = await deviceId(db);
    const now = new Date();
    await db.transaction("rw", db.outbox, db.photos, async () => {
      await db.photos.add({ photoId, clientMutationId, blob, contentType: blob.type, byteSize: blob.size, sha256, createdAt: now.toISOString() });
      await db.outbox.add(newOutboxEntry({ clientMutationId, deviceId: device, farmId, operation: "ATTACH_PHOTO", payload: checked.payload, dependsOn: "parentMutationId" in parent ? parent.parentMutationId : null }, now));
    });
    return clientMutationId;
  });
  return saved.saved ? { status: "SAVED", clientMutationId } : { status: "NOT_SAVED", reason: saved.reason };
}
