import { beforeEach, expect, it, vi } from "vitest";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const mocks = vi.hoisted(() => ({ recordTransaction: vi.fn(), settle: vi.fn(), reverse: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error("REDIRECT:" + path); }) }));
vi.mock("@/modules/farm-accounting/infrastructure/services", () => ({ farmAccountingService: () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { recordTransactionAction, reverseAccountingAction, settleRecordAction } from "@/app/farms/[farmId]/accounting/actions";
const requestId = crypto.randomUUID();
beforeEach(() => vi.clearAllMocks());

it("redirects to the saved record only after commit, using the service's farm (P04-T003)", async () => {
  mocks.recordTransaction.mockResolvedValueOnce({ farmId: "farm-a", recordId: "record-a" });
  await expect(recordTransactionAction("untrusted", "SALE", {})).rejects.toThrow("REDIRECT:/farms/farm-a/accounting/records/record-a?saved=1");
  expect(mocks.recordTransaction).toHaveBeenCalledWith("SALE", "untrusted", {});
});
it("rejects an unknown bound record kind before calling the service", async () => {
  expect(await recordTransactionAction("farm-a", "NET" as "SALE", {})).toEqual({ ok: false, message: expect.stringContaining("Check the details") });
  expect(mocks.recordTransaction).not.toHaveBeenCalled();
});
it("explains invalid money and changed retries without leaking provider details", async () => {
  mocks.recordTransaction.mockRejectedValueOnce(new FoundationError("INVALID_INPUT"));
  expect(await recordTransactionAction("farm-a", "EXPENSE", {})).toEqual({ ok: false, message: expect.stringContaining("digits only (no commas)") });
  mocks.recordTransaction.mockRejectedValueOnce(new FoundationError("CONFLICT"));
  expect(await recordTransactionAction("farm-a", "EXPENSE", {})).toEqual({ ok: false, message: expect.stringContaining("already used for a different record") });
  mocks.recordTransaction.mockRejectedValueOnce(new Error("private-provider-detail"));
  const failed = await recordTransactionAction("farm-a", "EXPENSE", {});
  expect(failed).toEqual({ ok: false, message: expect.stringContaining("Your details are still here") }); expect(JSON.stringify(failed)).not.toContain("private-provider-detail");
});
it("settles through the service and explains overpayment", async () => {
  mocks.settle.mockResolvedValueOnce({ farmId: "farm-a", paymentId: "payment-a" });
  await expect(settleRecordAction("farm-a", "record-a", { amount: "80000" })).rejects.toThrow("REDIRECT:/farms/farm-a/accounting/records/record-a?paid=1");
  expect(mocks.settle).toHaveBeenCalledWith("farm-a", "record-a", { amount: "80000" });
  mocks.settle.mockRejectedValueOnce(new FoundationError("CONFLICT"));
  expect(await settleRecordAction("farm-a", "record-a", {})).toEqual({ ok: false, message: expect.stringContaining("more than what is still due") });
});
it("reverses only a confirmed, reasoned command with the bound type and target", async () => {
  mocks.reverse.mockResolvedValueOnce({ recordType: "PAYMENT", recordId: "payment-a" });
  await expect(reverseAccountingAction("farm-a", "PAYMENT", "payment-a", { requestId, reason: "Entered twice", confirmed: true })).rejects.toThrow("REDIRECT:/farms/farm-a/accounting/payments/payment-a?reversed=1");
  expect(mocks.reverse).toHaveBeenCalledWith("farm-a", { requestId, reason: "Entered twice", recordType: "PAYMENT", recordId: "payment-a" });
  for (const input of [{ requestId, reason: "x" }, { requestId, reason: "x", confirmed: "true" }, { requestId, reason: "x", confirmed: true, recordType: "SALE" }, null]) {
    expect(await reverseAccountingAction("farm-a", "SALE", "record-a", input)).toEqual({ ok: false, message: expect.stringContaining("confirm") });
  }
  expect(await reverseAccountingAction("farm-a", "CATEGORY" as "SALE", "record-a", { requestId, reason: "x", confirmed: true })).toMatchObject({ ok: false });
  expect(mocks.reverse).toHaveBeenCalledTimes(1);
  mocks.reverse.mockRejectedValueOnce(new FoundationError("CONFLICT"));
  expect(await reverseAccountingAction("farm-a", "SALE", "record-a", { requestId, reason: "x", confirmed: true })).toEqual({ ok: false, message: expect.stringContaining("Reverse its payments first") });
});
