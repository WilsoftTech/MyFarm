import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { assertSameFarm, displayText, enterpriseWorkflow, isCalendarDate, type EnterpriseReference, type FarmScope, type PlotReference, type SeasonReference } from "@/modules/enterprises-seasons/domain/production";
import { moneyString, moneyUnits, normalizeCurrency, normalizePositiveAmount, type Money } from "./money";

/**
 * D-P04-003: a SALE/PURCHASE is the single revenue/cost event and creates the receivable/payable.
 * INCOME/EXPENSE cover items that are not sales/purchases and are settled when recorded.
 * Payments only settle obligations; they never create revenue or cost.
 */
export const ACCOUNTING_RECORD_KINDS = ["EXPENSE", "INCOME", "PURCHASE", "SALE"] as const;
export type AccountingRecordKind = typeof ACCOUNTING_RECORD_KINDS[number];
export const CATEGORY_KINDS = ["COST", "REVENUE"] as const;
export type CategoryKind = typeof CATEGORY_KINDS[number];
export const RECORD_CATEGORY_KIND: Readonly<Record<AccountingRecordKind, CategoryKind>> = Object.freeze({ EXPENSE: "COST", PURCHASE: "COST", INCOME: "REVENUE", SALE: "REVENUE" });
export const OBLIGATION_KINDS = ["SALE", "PURCHASE"] as const;
export type ObligationKind = typeof OBLIGATION_KINDS[number];
export const PAYMENT_DIRECTIONS = ["RECEIVED", "MADE"] as const;
export type PaymentDirection = typeof PAYMENT_DIRECTIONS[number];
/** RECEIVED settles a sale's receivable; MADE settles a purchase's payable. */
export const PAYMENT_SETTLES: Readonly<Record<PaymentDirection, ObligationKind>> = Object.freeze({ RECEIVED: "SALE", MADE: "PURCHASE" });
/** Posted records are never edited; a correction appends a reversal (D-P04-002). */
export const ACCOUNTING_STATUSES = ["POSTED", "REVERSED"] as const;
export type AccountingStatus = typeof ACCOUNTING_STATUSES[number];
export const REVERSIBLE_TYPES = [...ACCOUNTING_RECORD_KINDS, "PAYMENT"] as const;
export type ReversibleType = typeof REVERSIBLE_TYPES[number];
/** Accrual is the default reporting basis; every report labels the basis it used (D-P04-002). */
export const RECOGNITION_BASES = ["ACCRUAL", "CASH"] as const;
export type RecognitionBasis = typeof RECOGNITION_BASES[number];
export const DEFAULT_RECOGNITION_BASIS: RecognitionBasis = "ACCRUAL";
export const MAX_PAYMENT_ALLOCATIONS = 50;

/** Optional analytical links; the farm itself is always the owner. Activity links arrive in Phase 6. */
export interface AccountingLinks { plotId?: string; enterpriseId?: string; seasonId?: string }
export interface AccountingRecordFields extends AccountingLinks, Money {
  kind: AccountingRecordKind;
  categoryId: string;
  occurredOn: string;
  counterparty?: string;
  paymentMethodId?: string;
}
export interface CategoryReference { categoryId: string; kind: CategoryKind; active: boolean }
export interface PaymentMethodReference { paymentMethodId: string; active: boolean }
export interface AccountingRecordParents {
  category: CategoryReference;
  paymentMethod?: PaymentMethodReference;
  plot?: PlotReference;
  enterprise?: EnterpriseReference;
  season?: SeasonReference;
  /** Crop cycles of the linked CROP enterprise on the authorized farm (any status), needed when plot/season are linked too. */
  cropCycles?: readonly CropCycleLinkReference[];
}
export interface CropCycleLinkReference extends FarmScope { cycleId: string; enterpriseId: string; seasonId: string; plotId: string }

/** A sale or purchase as the settlement rules see it; outstanding is always derived, never stored. */
export interface ObligationReference extends FarmScope, Money { obligationId: string; kind: ObligationKind; occurredOn: string; status: AccountingStatus }
export interface PaymentAllocationEntry { obligationId: string; amount: string }
export interface AllocationRecord extends PaymentAllocationEntry { paymentId: string; status: AccountingStatus }
export interface PaymentFields extends Money {
  direction: PaymentDirection;
  paidOn: string;
  paymentMethodId: string;
  allocations: readonly PaymentAllocationEntry[];
}
export const SETTLEMENT_STATES = ["OPEN", "PARTIALLY_SETTLED", "SETTLED", "VOID"] as const;
export type SettlementState = typeof SETTLEMENT_STATES[number];
export interface ObligationBalance extends Money { obligationId: string; settled: string; outstanding: string; settlement: SettlementState }

export function settlesObligation(direction: PaymentDirection, kind: ObligationKind): boolean {
  return PAYMENT_SETTLES[direction] === kind;
}
/** A sale is settled by money RECEIVED, a purchase by money MADE; never chosen by the client. */
export function settlementDirection(kind: ObligationKind): PaymentDirection {
  if (kind === "SALE") return "RECEIVED";
  if (kind === "PURCHASE") return "MADE";
  throw new FoundationError("INVALID_INPUT");
}
/** Display form for counterparty and reason text; the farmer's capitalization is kept. */
export function normalizeAccountingText(value: string): string {
  return displayText(value);
}

function assertMoney(value: Money): void {
  if (normalizePositiveAmount(value.amount) !== value.amount || normalizeCurrency(value.currency) !== value.currency) throw new FoundationError("INVALID_INPUT");
}
function assertLink<T extends FarmScope>(scope: FarmScope, id: string | undefined, parent: T | undefined, parentId: (parent: T) => string): void {
  if (id === undefined && parent === undefined) return;
  if (id === undefined || parent === undefined) throw new FoundationError("INVALID_INPUT");
  assertSameFarm(scope, [parent]);
  if (parentId(parent) !== id) throw new FoundationError("FORBIDDEN");
}
function assertPaymentMethod(id: string | undefined, method: PaymentMethodReference | undefined): void {
  if (id === undefined && method === undefined) return;
  if (id === undefined || method === undefined || method.paymentMethodId !== id) throw new FoundationError("INVALID_INPUT");
  if (!method.active) throw new FoundationError("CONFLICT");
}

/**
 * Deterministic value/parent rule, NOT authentication. Parents must be looked up under current
 * authorization. Closed enterprises/seasons stay linkable so late bills keep their analytical link;
 * deeper plot/enterprise/season consistency belongs to R003 (T007).
 */
export function assertAccountingRecord(scope: FarmScope, fields: AccountingRecordFields, parents: AccountingRecordParents): void {
  if (!ACCOUNTING_RECORD_KINDS.includes(fields.kind)) throw new FoundationError("INVALID_INPUT");
  assertMoney(fields);
  if (!isCalendarDate(fields.occurredOn)) throw new FoundationError("INVALID_INPUT");
  if (parents.category.categoryId !== fields.categoryId || parents.category.kind !== RECORD_CATEGORY_KIND[fields.kind]) throw new FoundationError("INVALID_INPUT");
  if (!parents.category.active) throw new FoundationError("CONFLICT");
  if (OBLIGATION_KINDS.includes(fields.kind as ObligationKind) && (fields.paymentMethodId !== undefined || parents.paymentMethod !== undefined)) throw new FoundationError("INVALID_INPUT");
  assertPaymentMethod(fields.paymentMethodId, parents.paymentMethod);
  assertLink(scope, fields.plotId, parents.plot, plot => plot.plotId);
  assertLink(scope, fields.enterpriseId, parents.enterprise, enterprise => enterprise.enterpriseId);
  assertLink(scope, fields.seasonId, parents.season, season => season.seasonId);
  assertCropCycleLink(scope, fields, parents.enterprise, parents.cropCycles ?? []);
}

/**
 * D-P04-007: a CROP enterprise linked together with a plot and/or season must match one of its crop
 * cycles (any status, so late bills still link), e.g. Maize · 2027A · Plot 1. Other enterprise types
 * and records without an enterprise only need same-farm links.
 */
export function assertCropCycleLink(scope: FarmScope, links: AccountingLinks, enterprise: EnterpriseReference | undefined, cycles: readonly CropCycleLinkReference[]): void {
  if (!enterprise || enterpriseWorkflow(enterprise.type) !== "CROP_CYCLE" || (!links.plotId && !links.seasonId)) return;
  assertSameFarm(scope, cycles);
  const match = cycles.some(cycle => cycle.enterpriseId === enterprise.enterpriseId && (!links.plotId || cycle.plotId === links.plotId) && (!links.seasonId || cycle.seasonId === links.seasonId));
  if (!match) throw new FoundationError("INVALID_INPUT");
}

/** Receivable/payable = obligation total minus its POSTED allocations; a reversed obligation is VOID. */
export function obligationBalance(obligation: ObligationReference, allocations: readonly AllocationRecord[]): ObligationBalance {
  const total = moneyUnits(obligation.amount);
  let settled = 0n;
  for (const allocation of allocations) {
    if (allocation.obligationId !== obligation.obligationId) throw new FoundationError("INVALID_INPUT");
    if (allocation.status === "POSTED") settled += moneyUnits(allocation.amount);
  }
  if (settled > total || (obligation.status === "REVERSED" && settled > 0n)) throw new FoundationError("CONFLICT");
  const outstanding = obligation.status === "REVERSED" ? 0n : total - settled;
  const settlement: SettlementState = obligation.status === "REVERSED" ? "VOID" : settled === 0n ? "OPEN" : outstanding === 0n ? "SETTLED" : "PARTIALLY_SETTLED";
  return { obligationId: obligation.obligationId, amount: obligation.amount, currency: obligation.currency, settled: moneyString(settled), outstanding: moneyString(outstanding), settlement };
}

/**
 * Payments are fully allocated (no advances or unapplied credit in Phase 4) to POSTED obligations
 * of the matching kind and currency, dated on or after each obligation, never beyond what is
 * outstanding. Callers pass every obligation named by the payment and ALL their existing
 * allocations, read inside the write transaction; returns the resulting balances.
 */
export function assertPaymentAllocation(
  scope: FarmScope,
  fields: PaymentFields,
  parents: { paymentMethod: PaymentMethodReference; obligations: readonly ObligationReference[] },
  existing: readonly AllocationRecord[],
): ObligationBalance[] {
  assertMoney(fields);
  if (!PAYMENT_DIRECTIONS.includes(fields.direction) || !isCalendarDate(fields.paidOn)) throw new FoundationError("INVALID_INPUT");
  assertPaymentMethod(fields.paymentMethodId, parents.paymentMethod);
  if (fields.allocations.length < 1 || fields.allocations.length > MAX_PAYMENT_ALLOCATIONS) throw new FoundationError("INVALID_INPUT");
  const seen = new Set<string>();
  let allocated = 0n;
  const balances: ObligationBalance[] = [];
  for (const entry of fields.allocations) {
    if (seen.has(entry.obligationId) || normalizePositiveAmount(entry.amount) !== entry.amount) throw new FoundationError("INVALID_INPUT");
    seen.add(entry.obligationId);
    const obligation = parents.obligations.find(candidate => candidate.obligationId === entry.obligationId);
    if (!obligation) throw new FoundationError("FORBIDDEN");
    assertSameFarm(scope, [obligation]);
    if (!settlesObligation(fields.direction, obligation.kind) || obligation.currency !== fields.currency || fields.paidOn < obligation.occurredOn) throw new FoundationError("INVALID_INPUT");
    if (obligation.status !== "POSTED") throw new FoundationError("CONFLICT");
    const before = obligationBalance(obligation, existing.filter(allocation => allocation.obligationId === obligation.obligationId));
    const units = moneyUnits(entry.amount);
    if (units > moneyUnits(before.outstanding)) throw new FoundationError("CONFLICT");
    allocated += units;
    balances.push(obligationBalance(obligation, [
      ...existing.filter(allocation => allocation.obligationId === obligation.obligationId),
      { paymentId: "pending", obligationId: obligation.obligationId, amount: entry.amount, status: "POSTED" },
    ]));
  }
  if (allocated !== moneyUnits(fields.amount)) throw new FoundationError("INVALID_INPUT");
  return balances;
}

export interface ReversalTarget extends FarmScope { recordType: ReversibleType; recordId: string; status: AccountingStatus }
/**
 * A record is reversed at most once, with a reason. A sale/purchase with POSTED allocations must
 * have those payments reversed first; reversing a payment reverses its allocations with it.
 */
export function assertReversal(scope: FarmScope, target: ReversalTarget, reason: string, postedAllocations: readonly AllocationRecord[]): void {
  assertSameFarm(scope, [target]);
  if (!REVERSIBLE_TYPES.includes(target.recordType)) throw new FoundationError("INVALID_INPUT");
  const text = normalizeAccountingText(reason);
  if (text.length < 1 || text.length > 500) throw new FoundationError("INVALID_INPUT");
  if (target.status !== "POSTED") throw new FoundationError("CONFLICT");
  if (OBLIGATION_KINDS.includes(target.recordType as ObligationKind) && postedAllocations.some(allocation => allocation.obligationId === target.recordId && allocation.status === "POSTED")) {
    throw new FoundationError("CONFLICT");
  }
}

export interface RecognitionRecord extends Money {
  recordId: string;
  kind: AccountingRecordKind;
  occurredOn: string;
  status: AccountingStatus;
  /** Report attribution (R004/R005); omitted means unassigned. */
  enterpriseId?: string | null;
  categoryId?: string;
  categoryName?: string;
}
export interface RecognitionPayment { paymentId: string; direction: PaymentDirection; paidOn: string; status: AccountingStatus; allocations: readonly PaymentAllocationEntry[] }
export type RecognitionEffect = CategoryKind;
export interface RecognitionEvent extends Money {
  basis: RecognitionBasis;
  effect: RecognitionEffect;
  recordId: string;
  kind: AccountingRecordKind;
  /** The payment whose allocation produced a cash-basis sale/purchase event; null otherwise. */
  paymentId: string | null;
  recognizedOn: string;
  enterpriseId: string | null;
  categoryId: string | null;
  categoryName: string | null;
}

/**
 * Deterministic recognition over a complete source set. ACCRUAL: every POSTED record is exactly one
 * event on its own date and payments add nothing. CASH: income/expense on their date (settled when
 * recorded); sales/purchases once per POSTED allocation on the payment date. Reversed records and
 * payments are excluded. Events are ordered by date, then record, then payment.
 */
export function recognizedEvents(basis: RecognitionBasis, records: readonly RecognitionRecord[], payments: readonly RecognitionPayment[]): RecognitionEvent[] {
  if (!RECOGNITION_BASES.includes(basis)) throw new FoundationError("INVALID_INPUT");
  const byId = new Map<string, RecognitionRecord>();
  for (const record of records) {
    if (byId.has(record.recordId)) throw new FoundationError("INVALID_INPUT");
    byId.set(record.recordId, record);
  }
  const event = (record: RecognitionRecord, amount: string, recognizedOn: string, paymentId: string | null): RecognitionEvent => ({
    basis, effect: RECORD_CATEGORY_KIND[record.kind], recordId: record.recordId, kind: record.kind, paymentId, amount, currency: record.currency, recognizedOn,
    enterpriseId: record.enterpriseId ?? null, categoryId: record.categoryId ?? null, categoryName: record.categoryName ?? null,
  });
  const events: RecognitionEvent[] = [];
  for (const record of records) {
    if (record.status !== "POSTED") continue;
    if (basis === "ACCRUAL" || !OBLIGATION_KINDS.includes(record.kind as ObligationKind)) events.push(event(record, record.amount, record.occurredOn, null));
  }
  for (const payment of payments) {
    if (payment.status !== "POSTED") continue;
    for (const allocation of payment.allocations) {
      const record = byId.get(allocation.obligationId);
      if (!record || !OBLIGATION_KINDS.includes(record.kind as ObligationKind) || !settlesObligation(payment.direction, record.kind as ObligationKind)) throw new FoundationError("INVALID_INPUT");
      if (record.status !== "POSTED") throw new FoundationError("CONFLICT");
      if (basis === "CASH") events.push(event(record, allocation.amount, payment.paidOn, payment.paymentId));
    }
  }
  return events.sort((a, b) => a.recognizedOn.localeCompare(b.recognizedOn) || a.recordId.localeCompare(b.recordId) || (a.paymentId ?? "").localeCompare(b.paymentId ?? ""));
}
