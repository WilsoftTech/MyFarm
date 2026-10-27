"use server";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { confirmReversalSchema } from "@/modules/farm-accounting/contracts/accounting";
import { ACCOUNTING_RECORD_KINDS, REVERSIBLE_TYPES, type AccountingRecordKind, type ReversibleType } from "@/modules/farm-accounting/domain/accounting";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { ACCOUNTING_CHOICE_KINDS, loadAccountingChoices, type AccountingChoiceKind } from "@/components/accounting/link-choices";
import type { ChoiceLoad } from "@/components/production/choice-types";

const base = (farmId: string) => "/farms/" + farmId + "/accounting";

export async function recordTransactionAction(farmId: string, kind: AccountingRecordKind, input: unknown) {
  return runServerCommand(async () => {
    // Bound action arguments are still untrusted.
    if (!ACCOUNTING_RECORD_KINDS.includes(kind)) throw new FoundationError("INVALID_INPUT");
    const row = await farmAccountingService().recordTransaction(kind, farmId, input);
    return base(row.farmId) + "/records/" + row.recordId + "?saved=1";
  }, "This record was not saved because these details were already used for a different record. Reload the page and enter it again.",
  "Check the details. Enter the amount as digits only (no commas), a three-letter currency such as UGX, a real date and an active category. If you link a crop enterprise with a season or plot, they must match one of its crop cycles.");
}

export async function settleRecordAction(farmId: string, recordId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await farmAccountingService().settle(farmId, recordId, input);
    return base(row.farmId) + "/records/" + recordId + "?paid=1";
  }, "This payment was not saved. It may be more than what is still due, or the record was reversed. Reload the page to see the latest amount.",
  "Check the payment. Enter digits only, no more than what is still due, a date on or after the record and how the money moved.");
}

export async function reverseAccountingAction(farmId: string, recordType: ReversibleType, recordId: string, input: unknown) {
  return runServerCommand(async () => {
    if (!REVERSIBLE_TYPES.includes(recordType)) throw new FoundationError("INVALID_INPUT");
    const parsed = confirmReversalSchema.safeParse(input);
    if (!parsed.success) throw new FoundationError("INVALID_INPUT");
    const result = await farmAccountingService().reverse(farmId, { requestId: parsed.data.requestId, reason: parsed.data.reason, recordType, recordId });
    return base(farmId) + (recordType === "PAYMENT" ? "/payments/" : "/records/") + result.recordId + "?reversed=1";
  }, recordType === "PAYMENT" ? "This payment could not be reversed. It may already be reversed. Reload the page to see its status."
    : "This record could not be reversed. Reverse its payments first, or it may already be reversed. Reload the page to see its status.",
  "Enter a reason and confirm that you want to reverse this record.");
}

export async function moreAccountingChoicesAction(farmId: string, kind: AccountingChoiceKind, cursor: string): ReturnType<ChoiceLoad<AccountingChoiceKind>> {
  try {
    if (!ACCOUNTING_CHOICE_KINDS.includes(kind)) {
      await productionService().farmContext(farmId);
      return { ok: false, message: "Choose a valid list." };
    }
    return { ok: true, page: await loadAccountingChoices(farmId, kind, cursor) };
  }
  catch { return { ok: false, message: "Could not load more choices. Check your access and connection, then try again. Your details are still here." }; }
}
