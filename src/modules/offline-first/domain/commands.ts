import { OFFLINE_SUPPORT } from "./storage";
import type { OutboxEntry } from "./records";

/** Source P0458-P0465: six write actions plus two read actions served from the local cache. COMPLETE_ACTIVITY is what a stale version can conflict on. */
export const OFFLINE_OPERATIONS = ["RECORD_EXPENSE", "RECORD_INCOME", "RECORD_HARVEST", "RECORD_ACTIVITY", "CREATE_TASK", "COMPLETE_ACTIVITY", "ATTACH_PHOTO"] as const;
export type OfflineOperation = typeof OFFLINE_OPERATIONS[number];
export const OPERATION_LABELS: Readonly<Record<OfflineOperation, string>> = Object.freeze({
  RECORD_EXPENSE: "Expense", RECORD_INCOME: "Income", RECORD_HARVEST: "Harvest", RECORD_ACTIVITY: "Activity done", CREATE_TASK: "Task", COMPLETE_ACTIVITY: "Activity marked done", ATTACH_PHOTO: "Photo",
});
/** A photo attaches to one of these. Each has a stored ID once its parent command is accepted. */
export const PHOTO_TARGETS = ["ACTIVITY", "ACCOUNTING_RECORD"] as const;
export type PhotoTarget = typeof PHOTO_TARGETS[number];

export interface NewCommand { clientMutationId: string; deviceId: string; farmId: string; operation: OfflineOperation; payload: Record<string, unknown>; baseVersion?: number | null; dependsOn?: string | null }
/** Local validation has passed by this point, so a new entry starts ready to send. */
export function newOutboxEntry(command: NewCommand, now: Date): OutboxEntry {
  const at = now.toISOString();
  return { clientMutationId: command.clientMutationId, deviceId: command.deviceId, farmId: command.farmId, operation: command.operation, payload: command.payload, baseVersion: command.baseVersion ?? null, dependsOn: command.dependsOn ?? null,
    createdAt: at, updatedAt: at, syncStatus: "PENDING", version: 1, attemptCount: 0, nextAttemptAt: null, leaseUntil: null, lastError: null, result: null };
}

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";
/** Reads the bytes rather than trusting a declared type. */
export function detectPhotoType(bytes: Uint8Array): PhotoType | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}
/** D-P07-004 interim rule. */
export function photoProblem(bytes: Uint8Array, declaredType: string): "EMPTY" | "TOO_LARGE" | "NOT_AN_IMAGE" | "TYPE_MISMATCH" | null {
  if (bytes.length === 0) return "EMPTY";
  if (bytes.length > OFFLINE_SUPPORT.maxPhotoBytes) return "TOO_LARGE";
  const detected = detectPhotoType(bytes);
  if (!detected) return "NOT_AN_IMAGE";
  return detected === declaredType ? null : "TYPE_MISMATCH";
}

/** Bounds cached data on low-cost phones. Older records stay available online. */
export const PULL_LIMITS = Object.freeze({ pageSize: 50, maxRowsPerSection: 200, maxFarms: 50, cursorHours: 24 });
export const PULL_SECTIONS = ["ENTERPRISES", "PLOTS", "CROP_CYCLES", "STORES", "COST_CATEGORIES", "REVENUE_CATEGORIES", "PAYMENT_METHODS", "ACCOUNTING_RECORDS", "HARVESTS", "ACTIVITIES", "POULTRY_BATCHES"] as const;
export type PullSection = typeof PULL_SECTIONS[number];
/** Reference choices the entry forms need; the rest are records for reading. */
export const CATALOG_SECTIONS: readonly PullSection[] = Object.freeze(["ENTERPRISES", "PLOTS", "CROP_CYCLES", "STORES", "COST_CATEGORIES", "REVENUE_CATEGORIES", "PAYMENT_METHODS", "POULTRY_BATCHES"] as const);

export interface PullPosition { snapshotId: string; issuedAt: string; farmIndex: number; sectionIndex: number; pageCursor: string | null; taken: number }
/** A cursor grants nothing: every page is authorized again, so a forged one can only reach what the account may already read. */
export function encodePullCursor(position: PullPosition): string {
  return btoa(JSON.stringify(position)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
export function decodePullCursor(cursor: string): unknown {
  try { return JSON.parse(atob(cursor.replaceAll("-", "+").replaceAll("_", "/"))); } catch { return null; }
}
export function isPullCursorExpired(position: PullPosition, now: Date): boolean {
  const issued = Date.parse(position.issuedAt);
  return !Number.isFinite(issued) || issued > now.getTime() + 300_000 || now.getTime() - issued > PULL_LIMITS.cursorHours * 3_600_000;
}
/** Advances one page: next page of this section, else the next section, else the next farm, else finished. */
export function nextPullPosition(position: PullPosition, pageCursor: string | null, rows: number, farmCount: number): PullPosition | null {
  const taken = position.taken + rows;
  if (pageCursor && taken < PULL_LIMITS.maxRowsPerSection) return { ...position, pageCursor, taken };
  if (position.sectionIndex + 1 < PULL_SECTIONS.length) return { ...position, sectionIndex: position.sectionIndex + 1, pageCursor: null, taken: 0 };
  if (position.farmIndex + 1 < farmCount) return { ...position, farmIndex: position.farmIndex + 1, sectionIndex: 0, pageCursor: null, taken: 0 };
  return null;
}
