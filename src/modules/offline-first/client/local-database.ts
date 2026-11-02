import Dexie, { type Table } from "dexie";
import { offlineDatabaseName, OFFLINE_STORES } from "../domain/storage";
import type { CachedCatalog, CachedFarm, CachedRecord, LocalMeta, LocalPhoto, OutboxEntry } from "../domain/records";

/** One database per account (D-P07-003). New schema versions must keep outbox and photos intact. */
export class LocalDatabase extends Dexie {
  farms!: Table<CachedFarm, string>;
  records!: Table<CachedRecord, [string, string]>;
  catalogs!: Table<CachedCatalog, [string, string]>;
  outbox!: Table<OutboxEntry, string>;
  photos!: Table<LocalPhoto, string>;
  meta!: Table<LocalMeta, string>;
  constructor(accountId: string) {
    super(offlineDatabaseName(accountId));
    this.version(1).stores({
      farms: "farmId",
      records: "[section+id], farmId, [farmId+section], snapshotId",
      catalogs: "[farmId+kind], farmId",
      outbox: "clientMutationId, syncStatus, createdAt, farmId, dependsOn",
      photos: "photoId, clientMutationId",
      meta: "key",
    });
  }
}

const open = new Map<string, LocalDatabase>();
export function localDatabase(accountId: string): LocalDatabase {
  let db = open.get(accountId);
  if (!db) { db = new LocalDatabase(accountId); open.set(accountId, db); }
  return db;
}

/** D-P07-003: cached farm data goes; outbox and photos stay, hidden until this account signs in again. */
export async function clearCachedData(db: LocalDatabase): Promise<void> {
  await db.transaction("rw", OFFLINE_STORES.cached.map(name => db.table(name)), async () => {
    await Promise.all(OFFLINE_STORES.cached.map(name => db.table(name).clear()));
  });
}

export async function deviceId(db: LocalDatabase): Promise<string> {
  return db.transaction("rw", db.meta, async () => {
    const existing = await db.meta.get("deviceId");
    if (existing) return existing.value;
    const value = crypto.randomUUID();
    await db.meta.put({ key: "deviceId", value });
    return value;
  });
}
