/** Source P0474-P0479. */
export const SYNC_STATUSES = ["LOCAL_ONLY", "PENDING", "SYNCING", "SYNCED", "CONFLICT", "FAILED"] as const;
export type SyncStatus = typeof SYNC_STATUSES[number];
/** Everything not yet confirmed by the server; these are what sign-out must keep and the farmer must be warned about. */
export const UNSENT_STATUSES: readonly SyncStatus[] = Object.freeze(["LOCAL_ONLY", "PENDING", "SYNCING", "CONFLICT", "FAILED"] as const);

/** One offline intent. Client identity fields are routing hints, never server authority. */
export interface OutboxEntry {
  clientMutationId: string;
  deviceId: string;
  farmId: string;
  operation: string;
  payload: Record<string, unknown>;
  /** The version the farmer saw, for commands that change an existing record. */
  baseVersion: number | null;
  /** clientMutationId of a local parent that must be accepted first. */
  dependsOn: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  /** Local revision of this entry: bumped on every status change. */
  version: number;
  attemptCount: number;
  nextAttemptAt: string | null;
  leaseUntil: string | null;
  lastError: string | null;
  /** The server's confirmed record, kept so children can resolve their parent. */
  result: Record<string, unknown> | null;
}
export interface LocalPhoto { photoId: string; clientMutationId: string; blob: Blob; contentType: string; byteSize: number; sha256: string; createdAt: string }
export interface CachedFarm { farmId: string; name: string; cachedAt: string }
/** A server record kept for reading offline. snapshotId marks which pull wrote it, so a finished pull can replace older rows. */
export interface CachedRecord { section: string; id: string; farmId: string; snapshotId: string; data: Record<string, unknown> }
export interface LocalMeta { key: string; value: string }
