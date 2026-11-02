import { z } from "zod";
import type { LocalSaveFailure, StorageWarning } from "../domain/storage";

const bytes = z.number().int().nonnegative().nullable();
const instant = z.iso.datetime().nullable();
/** Browser storage reports are not trusted: a malformed one is rejected rather than shown as healthy. */
export const storageSnapshotSchema = z.object({ persisted: z.boolean().nullable(), usageBytes: bytes, quotaBytes: bytes, unsentEntries: z.number().int().nonnegative(), lastSyncAt: instant, firstUnsentAt: instant }).strict();

export const storageWarningLabels: Record<StorageWarning, string> = {
  NOT_PERSISTENT: "This browser may clear saved entries if the phone runs low on space. Connect and sync when you can.",
  STORAGE_UNKNOWN: "This browser cannot report how much space is left.",
  STORAGE_LOW: "This phone is low on space. Connect and sync soon.",
  QUEUE_NEAR_LIMIT: "You are close to the limit of unsent entries. Connect and sync soon.",
  QUEUE_FULL: "You have reached the limit of unsent entries. Connect and sync before adding more.",
  SYNC_OVERDUE: "Some entries have waited over 10 days. Connect and sync soon, or download a copy.",
  BEYOND_SUPPORT: "Some entries have waited 14 days or more. They could be lost if the browser clears its data. Download a copy and connect as soon as you can.",
};
export const localSaveFailureLabels: Record<LocalSaveFailure, string> = {
  QUOTA_EXCEEDED: "Not saved: this phone is out of space. Your details are still here. Free some space or connect and sync, then try again.",
  QUEUE_FULL: "Not saved: you have reached the limit of unsent entries. Your details are still here. Connect and sync, then try again.",
  STORAGE_UNAVAILABLE: "Not saved: this browser is not allowing MyFarm to store data, which can happen in private browsing. Your details are still here.",
  SAVE_FAILED: "Not saved: something went wrong on this phone. Your details are still here. Try again.",
};
