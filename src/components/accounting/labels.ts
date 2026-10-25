import type { AccountingRecordKind, AccountingStatus, ObligationKind, SettlementState } from "@/modules/farm-accounting/domain/accounting";

/** URL segments for the record screens; the server maps them to kinds, never the reverse from input. */
export const recordKindSlugs = { expense: "EXPENSE", income: "INCOME", sale: "SALE", purchase: "PURCHASE" } as const satisfies Record<string, AccountingRecordKind>;
export type RecordKindSlug = keyof typeof recordKindSlugs;
export function recordKindFromSlug(slug: string): AccountingRecordKind | null {
  return Object.hasOwn(recordKindSlugs, slug) ? recordKindSlugs[slug as RecordKindSlug] : null;
}

export const recordKindLabels: Record<AccountingRecordKind, string> = { EXPENSE: "Expense", INCOME: "Other income", SALE: "Sale", PURCHASE: "Purchase" };
export const recordKindTitles: Record<AccountingRecordKind, string> = { EXPENSE: "Record an expense", INCOME: "Record other income", SALE: "Record a sale", PURCHASE: "Record a purchase" };
export const recordKindHelp: Record<AccountingRecordKind, string> = {
  EXPENSE: "Money you paid at the time, for example labour, transport or fuel. For something you will pay for later, record a purchase instead.",
  INCOME: "Money you received that is not from a sale, for example a grant. For produce or animals you sold, record a sale instead.",
  SALE: "Something you sold. After saving, record the money you received, now or later, in one or more payments.",
  PURCHASE: "Something you bought, for example fertilizer from a supplier. After saving, record what you paid, now or later, in one or more payments.",
};
export const counterpartyLabels: Record<AccountingRecordKind, string> = { EXPENSE: "Paid to", INCOME: "Received from", SALE: "Buyer", PURCHASE: "Supplier" };
export const recordStatusLabels: Record<AccountingStatus, string> = { POSTED: "Recorded", REVERSED: "Reversed" };

/** Plain words for receivables/payables: the farmer sees money still to receive or pay. */
export const settledLabels: Record<ObligationKind, string> = { SALE: "Received so far", PURCHASE: "Paid so far" };
export const outstandingLabels: Record<ObligationKind, string> = { SALE: "Still to receive", PURCHASE: "Still to pay" };
export const settlementLabels: Record<ObligationKind, Record<SettlementState, string>> = {
  SALE: { OPEN: "Nothing received yet", PARTIALLY_SETTLED: "Partly received", SETTLED: "Fully received", VOID: "Reversed — nothing to receive" },
  PURCHASE: { OPEN: "Nothing paid yet", PARTIALLY_SETTLED: "Partly paid", SETTLED: "Fully paid", VOID: "Reversed — nothing to pay" },
};
export const paymentActionLabels: Record<ObligationKind, string> = { SALE: "Record money received", PURCHASE: "Record a payment" };

/**
 * Display only: groups the whole part of an exact decimal string ("150000.5" → "UGX 150,000.5").
 * No arithmetic happens here; amounts come from the server already canonical.
 */
export function formatMoney(amount: string, currency: string): string {
  const [whole, fraction] = amount.split(".");
  return currency + " " + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (fraction ? "." + fraction : "");
}
