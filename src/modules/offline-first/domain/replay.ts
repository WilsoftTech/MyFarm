import type { OfflineOperation } from "./commands";

/** The receipt each operation writes. A retry reads its own receipt; any other receipt on the key means the key was reused. */
export const RECEIPT_ACTIONS: Readonly<Record<OfflineOperation, string>> = Object.freeze({
  RECORD_EXPENSE: "ACCOUNTING_EXPENSE_RECORDED",
  RECORD_INCOME: "ACCOUNTING_INCOME_RECORDED",
  RECORD_HARVEST: "HARVEST_RECORDED",
  RECORD_ACTIVITY: "ACTIVITY_RECORDED_DONE",
  CREATE_TASK: "ACTIVITY_SCHEDULED",
  COMPLETE_ACTIVITY: "ACTIVITY_COMPLETED",
  ATTACH_PHOTO: "RECORD_PHOTO_ADDED",
});
/**
 * Receipts are unique per tenant, request and action, so the same key on a different operation would otherwise create a second effect.
 * Same key and same payload replays inside the operation's own service; this catches the same key on another operation.
 */
export function keyReusedByAnotherOperation(operation: OfflineOperation, priorActions: readonly string[]): boolean {
  return priorActions.some(action => action !== RECEIPT_ACTIONS[operation]);
}
