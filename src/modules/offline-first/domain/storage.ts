import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

/** D-P07-002 and D-P07-004. The day and entry limits still need measuring on an approved device. */
export const OFFLINE_SUPPORT = Object.freeze({
  days: 14,
  warnAfterDays: 10,
  maxUnsentEntries: 500,
  warnAtUnsentEntries: 400,
  lowStorageBytes: 50 * 1024 * 1024,
  maxPhotoBytes: 2 * 1024 * 1024,
});

export const STORAGE_WARNINGS = ["NOT_PERSISTENT", "STORAGE_UNKNOWN", "STORAGE_LOW", "QUEUE_NEAR_LIMIT", "QUEUE_FULL", "SYNC_OVERDUE", "BEYOND_SUPPORT"] as const;
export type StorageWarning = typeof STORAGE_WARNINGS[number];
/** persisted, usage and quota are null when this browser cannot report them. */
export interface StorageSnapshot { persisted: boolean | null; usageBytes: number | null; quotaBytes: number | null; unsentEntries: number; lastSyncAt: string | null; firstUnsentAt: string | null }
export interface StorageHealth { canSave: boolean; warnings: StorageWarning[]; unsentEntries: number; lastSyncAt: string | null; daysSinceSync: number | null }

const wholeDaysBetween = (from: string, now: Date) => Math.floor((now.getTime() - Date.parse(from)) / 86_400_000);

/** Durability warnings never block recording; only a full queue does, because storage is best-effort either way. */
export function storageHealth(snapshot: StorageSnapshot, now: Date): StorageHealth {
  const warnings: StorageWarning[] = [];
  if (snapshot.persisted !== true) warnings.push("NOT_PERSISTENT");
  if (snapshot.usageBytes === null || snapshot.quotaBytes === null) warnings.push("STORAGE_UNKNOWN");
  else if (snapshot.quotaBytes - snapshot.usageBytes < OFFLINE_SUPPORT.lowStorageBytes) warnings.push("STORAGE_LOW");
  const full = snapshot.unsentEntries >= OFFLINE_SUPPORT.maxUnsentEntries;
  if (full) warnings.push("QUEUE_FULL");
  else if (snapshot.unsentEntries >= OFFLINE_SUPPORT.warnAtUnsentEntries) warnings.push("QUEUE_NEAR_LIMIT");
  // Age counts from the oldest unsent entry: a farmer with nothing waiting is not at risk, however old the last sync is.
  const unsentDays = snapshot.unsentEntries > 0 && snapshot.firstUnsentAt ? wholeDaysBetween(snapshot.firstUnsentAt, now) : null;
  if (unsentDays !== null && unsentDays >= OFFLINE_SUPPORT.days) warnings.push("BEYOND_SUPPORT");
  else if (unsentDays !== null && unsentDays >= OFFLINE_SUPPORT.warnAfterDays) warnings.push("SYNC_OVERDUE");
  return { canSave: !full, warnings, unsentEntries: snapshot.unsentEntries, lastSyncAt: snapshot.lastSyncAt, daysSinceSync: snapshot.lastSyncAt ? wholeDaysBetween(snapshot.lastSyncAt, now) : null };
}

export type LocalSaveFailure = "QUOTA_EXCEEDED" | "QUEUE_FULL" | "STORAGE_UNAVAILABLE" | "SAVE_FAILED";
export type LocalSaveResult<T> = { saved: true; value: T } | { saved: false; reason: LocalSaveFailure };
const errorName = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null;
  const { name, inner } = error as { name?: unknown; inner?: unknown };
  // Dexie wraps the browser error, so the cause may be one level down.
  if (name === "QuotaExceededError" || (typeof inner === "object" && inner !== null && (inner as { name?: unknown }).name === "QuotaExceededError")) return "QuotaExceededError";
  return typeof name === "string" ? name : null;
};
/** Anything thrown while saving locally means nothing was saved; callers must keep the farmer's input on screen. */
export function classifyLocalSaveError(error: unknown): LocalSaveFailure {
  const name = errorName(error);
  if (name === "QuotaExceededError") return "QUOTA_EXCEEDED";
  if (name === "SecurityError" || name === "InvalidStateError" || name === "MissingAPIError" || name === "OpenFailedError") return "STORAGE_UNAVAILABLE";
  return "SAVE_FAILED";
}

/** D-P07-003: one database per account, so a shared phone never mixes accounts' records. */
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function offlineDatabaseName(accountId: string): string {
  if (!ACCOUNT_ID.test(accountId)) throw new FoundationError("INVALID_INPUT");
  return "myfarm-offline-" + accountId;
}
/** D-P07-003: sign-out clears cached farm data but keeps unsent work, hidden until that account signs in again. */
export const OFFLINE_STORES = Object.freeze({ cached: Object.freeze(["farms", "records"] as const), unsent: Object.freeze(["outbox", "photos"] as const) });

export const OFFLINE_SHELL_PATH = "/offline";
export type ServiceWorkerPolicy = "STATIC_CACHE" | "OFFLINE_SHELL" | "NETWORK_THEN_SHELL" | "NETWORK_ONLY";
/**
 * Signed-in pages and API responses are never stored by the service worker: they stay private and no-store.
 * Offline data is read from the account's own local database instead.
 */
export function serviceWorkerPolicy(request: { method: string; sameOrigin: boolean; pathname: string; navigation: boolean }): ServiceWorkerPolicy {
  if (request.method !== "GET" || !request.sameOrigin || request.pathname.startsWith("/api/")) return "NETWORK_ONLY";
  if (request.pathname.startsWith("/_next/static/") || request.pathname === "/manifest.webmanifest" || request.pathname === "/icon.svg") return "STATIC_CACHE";
  if (request.pathname === OFFLINE_SHELL_PATH) return "OFFLINE_SHELL";
  return request.navigation ? "NETWORK_THEN_SHELL" : "NETWORK_ONLY";
}
