import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { farmPageSchema } from "@/modules/farmer-registry/contracts/registry";
import { isCalendarDate, type FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ProductionPage, ProductionRecord, ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { CATEGORY_KINDS, MAX_PAYMENT_ALLOCATIONS, PAYMENT_DIRECTIONS, RECOGNITION_BASES, REVERSIBLE_TYPES, normalizeAccountingText, type AccountingRecordKind, type AccountingStatus, type CategoryKind, type ObligationBalance, type PaymentDirection, type ReversibleType } from "../domain/accounting";
import { moneyString, moneyUnits, normalizeCurrency, normalizePositiveAmount } from "../domain/money";

const optionalId = z.union([z.literal(""), idSchema]).optional().transform(value => value || undefined);
const optionalText = (max: number) => z.string().transform(normalizeAccountingText).pipe(z.string().max(max, "Use " + max + " characters or fewer.")).optional().transform(value => value || undefined);
const date = z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD.");
export const amountSchema = z.union([z.string(), z.number()]).transform((value, context) => {
  const amount = normalizePositiveAmount(value);
  if (amount === null) { context.addIssue({ code: "custom", message: "Enter an amount above 0 using digits, with up to 4 decimal places." }); return z.NEVER; }
  return amount;
});
export const currencySchema = z.string().transform((value, context) => {
  const currency = normalizeCurrency(value);
  if (currency === null) { context.addIssue({ code: "custom", message: "Choose a currency, for example UGX." }); return z.NEVER; }
  return currency;
});

/** Optional analytical links; the T002 service must resolve each under the authorized farm. activityId is Phase 6. */
export const accountingLinksSchema = z.object({ plotId: optionalId, enterpriseId: optionalId, seasonId: optionalId }).strict();
// Tenant, farm, actor, kind, status, version and balances are deliberately absent: the server derives them.
const recordBase = accountingLinksSchema.extend({
  requestId: idSchema,
  categoryId: idSchema,
  amount: amountSchema,
  currency: currencySchema,
  occurredOn: date,
  counterparty: optionalText(120),
});
/** Income and expenses are settled when recorded, so they may name how they were paid. */
export const recordExpenseSchema = recordBase.extend({ paymentMethodId: optionalId }).strict();
export const recordIncomeSchema = recordExpenseSchema;
/** Sales and purchases open a receivable/payable; payments are recorded separately and settle it. */
export const recordSaleSchema = recordBase.strict();
export const recordPurchaseSchema = recordSaleSchema;

export const paymentAllocationSchema = z.object({ obligationId: idSchema, amount: amountSchema }).strict();
export const recordPaymentSchema = z.object({
  requestId: idSchema,
  direction: z.enum(PAYMENT_DIRECTIONS, { error: "Choose whether money was received or paid." }),
  amount: amountSchema,
  currency: currencySchema,
  paidOn: date,
  paymentMethodId: idSchema,
  externalReference: optionalText(120),
  allocations: z.array(paymentAllocationSchema).min(1, "Choose what this payment settles.").max(MAX_PAYMENT_ALLOCATIONS, "A payment can settle up to " + MAX_PAYMENT_ALLOCATIONS + " records."),
}).strict().superRefine((value, context) => {
  if (typeof value.amount !== "string" || value.allocations.some(allocation => typeof allocation.amount !== "string")) return;
  const ids = value.allocations.map(allocation => allocation.obligationId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "Each record can appear only once in a payment.", path: ["allocations"] });
  const allocated = value.allocations.reduce((total, allocation) => total + moneyUnits(allocation.amount), 0n);
  if (allocated !== moneyUnits(value.amount)) context.addIssue({ code: "custom", message: "The amounts settled must add up to " + value.amount + ", not " + moneyString(allocated) + ".", path: ["allocations"] });
});

/**
 * Screen command to settle one sale/purchase: the service derives the direction, currency and
 * single allocation from the authorized record, so the client cannot choose them.
 */
export const settleObligationSchema = z.object({
  requestId: idSchema,
  amount: amountSchema,
  paidOn: date,
  paymentMethodId: idSchema,
  externalReference: optionalText(120),
}).strict();
export type SettleObligation = z.output<typeof settleObligationSchema>;

export const reverseAccountingRecordSchema = z.object({
  requestId: idSchema,
  recordType: z.enum(REVERSIBLE_TYPES),
  recordId: idSchema,
  reason: z.string().transform(normalizeAccountingText).pipe(z.string().min(1, "Explain why this record is being reversed.").max(500, "Use 500 characters or fewer.")),
}).strict();

/** Screen form: the target type and ID are bound server-side; the farmer must confirm explicitly. */
export const confirmReversalSchema = reverseAccountingRecordSchema.pick({ requestId: true, reason: true }).extend({
  confirmed: z.literal(true, { error: "Confirm that you want to reverse this record." }),
}).strict();
export type ConfirmReversal = z.output<typeof confirmReversalSchema>;

/**
 * Shape of a reviewed category/payment-method data release (D-P04-005). Names are validated, not
 * rewritten, by applyCategoryRelease/applyPaymentMethodRelease because they ship verbatim in reviewed
 * SQL. There is no tenant or farm field: catalogs are global and runtime roles never write them.
 */
export const categoryReleaseSchema = z.object({
  additions: z.array(z.object({ id: idSchema, kind: z.enum(CATEGORY_KINDS), name: z.string() }).strict()).max(200),
  deactivations: z.array(idSchema).max(200).default([]),
}).strict();
export const paymentMethodReleaseSchema = z.object({
  additions: z.array(z.object({ id: idSchema, name: z.string() }).strict()).max(200),
  deactivations: z.array(idSchema).max(200).default([]),
}).strict();
export type CategoryReleaseInput = z.output<typeof categoryReleaseSchema>;

export const accountingPageSchema = farmPageSchema;
export const categoryQuerySchema = farmPageSchema.extend({ kind: z.enum(CATEGORY_KINDS).optional() }).strict();
export const recognitionBasisSchema = z.enum(RECOGNITION_BASES);

export type RecordExpense = z.output<typeof recordExpenseSchema>;
export type RecordIncome = z.output<typeof recordIncomeSchema>;
export type RecordSale = z.output<typeof recordSaleSchema>;
export type RecordPurchase = z.output<typeof recordPurchaseSchema>;
export type RecordPayment = z.output<typeof recordPaymentSchema>;
export type ReverseAccountingRecord = z.output<typeof reverseAccountingRecordSchema>;
export type AccountingPageInput = z.output<typeof accountingPageSchema>;
export type CategoryQuery = z.output<typeof categoryQuerySchema>;
export type RecordCommand<K extends AccountingRecordKind> = K extends "EXPENSE" ? RecordExpense : K extends "INCOME" ? RecordIncome : K extends "SALE" ? RecordSale : RecordPurchase;

export interface ReversalView { reason: string; reversedBy: string; reversedAt: string }
export interface CategoryView { categoryId: string; kind: CategoryKind; name: string; active: boolean }
export interface PaymentMethodView { paymentMethodId: string; name: string; active: boolean }
export interface AccountingRecordView extends FarmScope, ProductionRecord {
  recordId: string;
  kind: AccountingRecordKind;
  categoryId: string;
  categoryName: string;
  amount: string;
  currency: string;
  occurredOn: string;
  counterparty: string | null;
  paymentMethodId: string | null;
  plotId: string | null;
  enterpriseId: string | null;
  seasonId: string | null;
  status: AccountingStatus;
  reversal: ReversalView | null;
  /** Receivable (SALE) or payable (PURCHASE) derived from allocations; null for income/expense. */
  balance: ObligationBalance | null;
  /** Payments allocated to this sale/purchase (POSTED and REVERSED), oldest first; empty for income/expense. */
  payments: { paymentId: string; amount: string; paidOn: string; status: AccountingStatus }[];
}
export interface PaymentView extends FarmScope, ProductionRecord {
  paymentId: string;
  direction: PaymentDirection;
  amount: string;
  currency: string;
  paidOn: string;
  paymentMethodId: string;
  externalReference: string | null;
  status: AccountingStatus;
  reversal: ReversalView | null;
  allocations: { obligationId: string; amount: string }[];
}

/**
 * Implemented in T002; application authorization precedes all calls.
 * Every read constrains tenant AND farm, including nested IDs and pagination anchors; foreign IDs return null.
 * Writes recheck current membership inside the transaction, resolve every parent under the scope and reuse
 * assertAccountingRecord / assertPaymentAllocation / assertReversal with existing allocations read under a
 * lock on the affected obligations. Rows and the actor/scope/request audit receipt commit atomically; identical
 * normalized retries replay, changed commands or scope conflict, failures roll back both.
 * Posted rows are never updated except status REVERSED plus its reversal row; reversing a payment reverses its
 * allocations in the same transaction. Category/payment-method catalogs and attachments are later tasks.
 * T005 (R002): record views add the categoryHistory() result (snapshot name plus whether the category is
 * archived) for every record, including records whose category is no longer offered; catalog pages stay
 * active-only for new records. Catalog changes ship only as reviewed releases checked by applyCategoryRelease.
 */
export interface FarmAccountingRepository {
  categories(scope: FarmScope, query: CategoryQuery): Promise<ProductionPage<CategoryView>>;
  paymentMethods(scope: FarmScope, page: AccountingPageInput): Promise<ProductionPage<PaymentMethodView>>;
  record(scope: FarmScope, recordId: string): Promise<AccountingRecordView | null>;
  records(scope: FarmScope, page: AccountingPageInput): Promise<ProductionPage<AccountingRecordView>>;
  payment(scope: FarmScope, paymentId: string): Promise<PaymentView | null>;
  recordTransaction<K extends AccountingRecordKind>(scope: ProductionWriteScope, kind: K, command: RecordCommand<K>): Promise<AccountingRecordView>;
  recordPayment(scope: ProductionWriteScope, command: RecordPayment): Promise<PaymentView>;
  reverse(scope: ProductionWriteScope, command: ReverseAccountingRecord): Promise<{ recordType: ReversibleType; recordId: string; reversal: ReversalView }>;
}
