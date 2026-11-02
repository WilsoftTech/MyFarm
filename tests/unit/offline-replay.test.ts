import { describe, expect, it } from "vitest";
import { OFFLINE_OPERATIONS } from "@/modules/offline-first/domain/commands";
import { RECEIPT_ACTIONS, keyReusedByAnotherOperation } from "@/modules/offline-first/domain/replay";

describe("MYF-P07-AC004 replay contract", () => {
  it("names one distinct receipt for every operation", () => {
    expect(Object.keys(RECEIPT_ACTIONS).sort()).toEqual([...OFFLINE_OPERATIONS].sort());
    expect(new Set(Object.values(RECEIPT_ACTIONS)).size).toBe(OFFLINE_OPERATIONS.length);
    expect(Object.isFrozen(RECEIPT_ACTIONS)).toBe(true);
  });
  it("lets a new key and a retry of the same operation through", () => {
    expect(keyReusedByAnotherOperation("RECORD_EXPENSE", [])).toBe(false);
    expect(keyReusedByAnotherOperation("RECORD_EXPENSE", ["ACCOUNTING_EXPENSE_RECORDED"])).toBe(false);
  });
  it.each(OFFLINE_OPERATIONS.flatMap(operation => OFFLINE_OPERATIONS.filter(other => other !== operation).map(other => [operation, other] as const)))("refuses %s on a key already used by %s", (operation, other) => {
    expect(keyReusedByAnotherOperation(operation, [RECEIPT_ACTIONS[other]])).toBe(true);
  });
  it("treats any unrelated receipt on the key as reuse", () => {
    expect(keyReusedByAnotherOperation("CREATE_TASK", ["ACTIVITY_SCHEDULED", "STORAGE_LOCATION_CREATED"])).toBe(true);
  });
});
