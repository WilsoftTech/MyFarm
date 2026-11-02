import { storageSnapshotSchema } from "../contracts/storage";
import { UNSENT_STATUSES } from "../domain/records";
import { classifyLocalSaveError, storageHealth, type LocalSaveResult, type StorageHealth, type StorageSnapshot } from "../domain/storage";
import type { LocalDatabase } from "./local-database";

/** Asking is best-effort: a refusal limits durability but does not stop recording. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : null; } catch { return null; }
}
async function browserStorage(): Promise<Pick<StorageSnapshot, "persisted" | "usageBytes" | "quotaBytes">> {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    return { persisted, usageBytes: estimate?.usage ?? null, quotaBytes: estimate?.quota ?? null };
  } catch { return { persisted: null, usageBytes: null, quotaBytes: null }; }
}
export async function storageSnapshot(db: LocalDatabase): Promise<StorageSnapshot> {
  const unsent = await db.outbox.where("syncStatus").anyOf([...UNSENT_STATUSES]).toArray();
  const firstUnsentAt = unsent.reduce<string | null>((oldest, row) => (!oldest || row.createdAt < oldest ? row.createdAt : oldest), null);
  const lastSyncAt = (await db.meta.get("lastSyncAt"))?.value ?? null;
  return storageSnapshotSchema.parse({ ...(await browserStorage()), unsentEntries: unsent.length, lastSyncAt, firstUnsentAt });
}
export async function currentStorageHealth(db: LocalDatabase, now = new Date()): Promise<StorageHealth> {
  return storageHealth(await storageSnapshot(db), now);
}
/** The only way local writes report success: the IndexedDB transaction must have committed. */
export async function saveLocally<T>(db: LocalDatabase, write: () => Promise<T>, now = new Date()): Promise<LocalSaveResult<T>> {
  try {
    if (!(await currentStorageHealth(db, now)).canSave) return { saved: false, reason: "QUEUE_FULL" };
    return { saved: true, value: await write() };
  } catch (error) { return { saved: false, reason: classifyLocalSaveError(error) }; }
}
