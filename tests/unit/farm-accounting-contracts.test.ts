import { describe, expect, it } from "vitest";
import { recordExpenseSchema, recordIncomeSchema, recordPaymentSchema, recordPurchaseSchema, recordSaleSchema, reverseAccountingRecordSchema } from "@/modules/farm-accounting/contracts/accounting";
import { assertAccountingRecord, assertPaymentAllocation, assertReversal, obligationBalance, recognizedEvents, DEFAULT_RECOGNITION_BASIS, MAX_PAYMENT_ALLOCATIONS, type AccountingRecordFields, type AccountingRecordParents, type AllocationRecord, type ObligationReference, type PaymentFields, type RecognitionPayment, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { moneyString, moneyUnits, normalizeCurrency, normalizePositiveAmount } from "@/modules/farm-accounting/domain/money";
import type { EnterpriseReference, FarmScope } from "@/modules/enterprises-seasons/domain/production";

const id = () => crypto.randomUUID();
const scope: FarmScope = { tenantId: id(), farmId: id() };
const otherFarm: FarmScope = { tenantId: scope.tenantId, farmId: id() };
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const forbidden = expect.objectContaining({ code: "FORBIDDEN" });
const conflict = expect.objectContaining({ code: "CONFLICT" });

const revenueCategory = { categoryId: id(), kind: "REVENUE" as const, active: true };
const costCategory = { categoryId: id(), kind: "COST" as const, active: true };
const mobileMoney = { paymentMethodId: id(), active: true };
const enterprise: EnterpriseReference = { ...scope, enterpriseId: id(), type: "CROP", status: "ACTIVE" };
const saleFields: AccountingRecordFields = { kind: "SALE", categoryId: revenueCategory.categoryId, amount: "200000", currency: "UGX", occurredOn: "2027-06-01", counterparty: "Market buyer" };
const saleParents: AccountingRecordParents = { category: revenueCategory };

const sale: ObligationReference = { ...scope, obligationId: id(), kind: "SALE", amount: "200000", currency: "UGX", occurredOn: "2027-06-01", status: "POSTED" };
const purchase: ObligationReference = { ...scope, obligationId: id(), kind: "PURCHASE", amount: "150000", currency: "UGX", occurredOn: "2027-03-10", status: "POSTED" };
const payment = (obligation: ObligationReference, amount: string, overrides: Partial<PaymentFields> = {}): PaymentFields => ({
  direction: obligation.kind === "SALE" ? "RECEIVED" : "MADE", amount, currency: obligation.currency, paidOn: "2027-06-05", paymentMethodId: mobileMoney.paymentMethodId,
  allocations: [{ obligationId: obligation.obligationId, amount }], ...overrides,
});
const posted = (obligation: ObligationReference, amount: string, status: AllocationRecord["status"] = "POSTED"): AllocationRecord => ({ paymentId: id(), obligationId: obligation.obligationId, amount, status });

describe("exact money (P04-T001)", () => {
  it.each([["150000", "150000"], [" 0150000.50 ", "150000.5"], [200000, "200000"], ["0.0001", "0.0001"], ["9999999999999999.9999", "9999999999999999.9999"], ["1.2300", "1.23"]])("normalizes %j to %j", (value, expected) => {
    expect(normalizePositiveAmount(value)).toBe(expected);
  });
  it.each(["0", 0, "0.0000", "-1", -1, "1e3", "150,000", "1.23456", "10000000000000000", 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "", " ", ".5", "5.", "+1", "UGX 100", null, undefined, true])("rejects a zero, signed, fractional-number, malformed or oversized amount %j", value => {
    expect(normalizePositiveAmount(value)).toBeNull();
  });
  it("adds decimals exactly, without binary floating point", () => {
    expect(moneyString(moneyUnits("0.1") + moneyUnits("0.2"))).toBe("0.3");
    expect(moneyString(moneyUnits("9999999999999999.9999") - moneyUnits("0.0001"))).toBe("9999999999999999.9998");
  });
  it.each([["ugx", "UGX"], [" usd ", "USD"], ["KES", "KES"], ["eur", "EUR"]])("normalizes the ISO 4217 currency %j", (value, expected) => {
    expect(normalizeCurrency(value)).toBe(expected);
  });
  it.each(["", "UG", "UGXX", "ABC", "XXX", "U$D", "shillings", 800, null])("rejects an unknown or malformed currency %j", value => {
    expect(normalizeCurrency(value)).toBeNull();
  });
});

describe("transaction command contracts (P04-T001)", () => {
  const command = { requestId: id(), categoryId: costCategory.categoryId, amount: "150000", currency: "ugx", occurredOn: "2027-03-10" };
  it("normalizes amount, currency, counterparty and blank optional links", () => {
    expect(recordExpenseSchema.parse({ ...command, amount: "0150000.00", counterparty: "  ABC   Agro ", plotId: "", enterpriseId: enterprise.enterpriseId, paymentMethodId: mobileMoney.paymentMethodId }))
      .toEqual({ ...command, amount: "150000", currency: "UGX", counterparty: "ABC Agro", plotId: undefined, enterpriseId: enterprise.enterpriseId, paymentMethodId: mobileMoney.paymentMethodId });
    expect(recordIncomeSchema.parse({ ...command, counterparty: "   " }).counterparty).toBeUndefined();
  });
  it.each([recordExpenseSchema, recordIncomeSchema, recordSaleSchema, recordPurchaseSchema])("rejects server-owned, Phase 6 and derived fields", schema => {
    for (const key of ["tenantId", "farmId", "kind", "status", "version", "createdBy", "balance", "outstanding", "activityId", "categoryName"]) {
      expect(schema.safeParse({ ...command, [key]: id() }).success).toBe(false);
    }
  });
  it.each(["requestId", "categoryId", "plotId", "enterpriseId", "seasonId"])("requires a UUID %s", key => {
    expect(recordExpenseSchema.safeParse({ ...command, [key]: "not-a-uuid" }).success).toBe(false);
  });
  it("keeps sales and purchases free of a payment method because payments settle them", () => {
    expect(recordSaleSchema.safeParse({ ...command, paymentMethodId: mobileMoney.paymentMethodId }).success).toBe(false);
    expect(recordPurchaseSchema.safeParse({ ...command, paymentMethodId: mobileMoney.paymentMethodId }).success).toBe(false);
    expect(recordPurchaseSchema.parse(command).amount).toBe("150000");
  });
  it.each([{ amount: "0" }, { amount: "150,000" }, { currency: "XYZ" }, { occurredOn: "2027-02-29" }, { occurredOn: "10/03/2027" }, { counterparty: "x".repeat(121) }])("rejects invalid input %j", change => {
    expect(recordExpenseSchema.safeParse({ ...command, ...change }).success).toBe(false);
  });
});

describe("payment and reversal command contracts (P04-T001)", () => {
  const obligationId = id();
  const command = { requestId: id(), direction: "RECEIVED", amount: "80000", currency: "UGX", paidOn: "2027-06-05", paymentMethodId: mobileMoney.paymentMethodId, allocations: [{ obligationId, amount: "80000" }] };
  it("accepts a fully allocated payment", () => {
    expect(recordPaymentSchema.parse({ ...command, externalReference: "  MM-123 " })).toEqual({ ...command, externalReference: "MM-123" });
  });
  it("accepts a payment split exactly across records", () => {
    expect(recordPaymentSchema.safeParse({ ...command, amount: "80000.5", allocations: [{ obligationId, amount: "50000.25" }, { obligationId: id(), amount: "30000.25" }] }).success).toBe(true);
  });
  it.each([
    ["no allocation", { allocations: [] }],
    ["unallocated remainder", { amount: "100000" }],
    ["over-allocation", { amount: "50000" }],
    ["duplicate record", { amount: "80000", allocations: [{ obligationId, amount: "40000" }, { obligationId, amount: "40000" }] }],
    ["too many records", { amount: String(MAX_PAYMENT_ALLOCATIONS + 1), allocations: Array.from({ length: MAX_PAYMENT_ALLOCATIONS + 1 }, () => ({ obligationId: id(), amount: "1" })) }],
    ["unknown direction", { direction: "REFUND" }],
    ["missing payment method", { paymentMethodId: undefined }],
    ["invalid allocation amount", { allocations: [{ obligationId, amount: "-80000" }] }],
    ["server-owned field", { status: "POSTED" }],
  ])("rejects %s", (_, change) => {
    expect(recordPaymentSchema.safeParse({ ...command, ...change }).success).toBe(false);
  });
  it("requires a reason and a reversible record type", () => {
    const reversal = { requestId: id(), recordType: "SALE", recordId: id(), reason: "  Entered twice  " };
    expect(reverseAccountingRecordSchema.parse(reversal).reason).toBe("Entered twice");
    expect(reverseAccountingRecordSchema.safeParse({ ...reversal, reason: "   " }).success).toBe(false);
    expect(reverseAccountingRecordSchema.safeParse({ ...reversal, reason: "x".repeat(501) }).success).toBe(false);
    expect(reverseAccountingRecordSchema.safeParse({ ...reversal, recordType: "CATEGORY" }).success).toBe(false);
  });
});

describe("record value and parent rules (P04-T001)", () => {
  it("accepts a sale and an expense with a payment method and same-farm links", () => {
    expect(() => assertAccountingRecord(scope, saleFields, saleParents)).not.toThrow();
    const expense: AccountingRecordFields = { ...saleFields, kind: "EXPENSE", categoryId: costCategory.categoryId, amount: "150000", paymentMethodId: mobileMoney.paymentMethodId, enterpriseId: enterprise.enterpriseId };
    expect(() => assertAccountingRecord(scope, expense, { category: costCategory, paymentMethod: mobileMoney, enterprise })).not.toThrow();
  });
  it("keeps a closed enterprise linkable so a late bill keeps its allocation", () => {
    expect(() => assertAccountingRecord(scope, { ...saleFields, enterpriseId: enterprise.enterpriseId }, { ...saleParents, enterprise: { ...enterprise, status: "CLOSED" } })).not.toThrow();
  });
  it.each([
    ["a revenue category on an expense", { ...saleFields, kind: "EXPENSE" as const }, saleParents],
    ["a cost category on a sale", { ...saleFields, categoryId: costCategory.categoryId }, { category: costCategory }],
    ["a mismatched category", saleFields, { category: { ...revenueCategory, categoryId: id() } }],
    ["a payment method on a sale", { ...saleFields, paymentMethodId: mobileMoney.paymentMethodId }, { ...saleParents, paymentMethod: mobileMoney }],
    ["a payment method without its lookup", { ...saleFields, kind: "INCOME" as const, paymentMethodId: mobileMoney.paymentMethodId }, saleParents],
    ["a link lookup without the link", saleFields, { ...saleParents, enterprise }],
    ["a non-canonical amount", { ...saleFields, amount: "200000.00" }, saleParents],
    ["a zero amount", { ...saleFields, amount: "0" }, saleParents],
    ["a lowercase currency", { ...saleFields, currency: "ugx" }, saleParents],
    ["an impossible date", { ...saleFields, occurredOn: "2027-02-30" }, saleParents],
  ])("rejects %s", (_, fields, parents) => {
    expect(() => assertAccountingRecord(scope, fields, parents)).toThrow(invalid);
  });
  it("rejects wrong-farm and substituted links", () => {
    expect(() => assertAccountingRecord(scope, { ...saleFields, enterpriseId: enterprise.enterpriseId }, { ...saleParents, enterprise: { ...enterprise, ...otherFarm } })).toThrow(forbidden);
    expect(() => assertAccountingRecord(scope, { ...saleFields, enterpriseId: id() }, { ...saleParents, enterprise })).toThrow(forbidden);
    expect(() => assertAccountingRecord(scope, { ...saleFields, plotId: id() }, { ...saleParents, plot: { ...otherFarm, plotId: id() } })).toThrow(forbidden);
  });
  it("rejects archived categories and payment methods for new records", () => {
    expect(() => assertAccountingRecord(scope, saleFields, { category: { ...revenueCategory, active: false } })).toThrow(conflict);
    expect(() => assertAccountingRecord(scope, { ...saleFields, kind: "INCOME", paymentMethodId: mobileMoney.paymentMethodId }, { ...saleParents, paymentMethod: { ...mobileMoney, active: false } })).toThrow(conflict);
  });
});

describe("AC001 oracle: one sale, partial payment, no double revenue (P04-T001)", () => {
  it("leaves UGX 120,000 due after UGX 80,000 of a UGX 200,000 sale is received", () => {
    const [after] = assertPaymentAllocation(scope, payment(sale, "80000"), { paymentMethod: mobileMoney, obligations: [sale] }, []);
    expect(after).toEqual({ obligationId: sale.obligationId, amount: "200000", currency: "UGX", settled: "80000", outstanding: "120000", settlement: "PARTIALLY_SETTLED" });
  });
  it("recognizes the sale once on accrual and the collection once on cash, never both", () => {
    const records: RecognitionRecord[] = [{ recordId: sale.obligationId, kind: "SALE", amount: "200000", currency: "UGX", occurredOn: "2027-06-01", status: "POSTED" }];
    const payments: RecognitionPayment[] = [{ paymentId: id(), direction: "RECEIVED", paidOn: "2027-06-05", status: "POSTED", allocations: [{ obligationId: sale.obligationId, amount: "80000" }] }];
    expect(DEFAULT_RECOGNITION_BASIS).toBe("ACCRUAL");
    expect(recognizedEvents("ACCRUAL", records, payments)).toEqual([expect.objectContaining({ basis: "ACCRUAL", effect: "REVENUE", amount: "200000", recognizedOn: "2027-06-01", paymentId: null })]);
    expect(recognizedEvents("CASH", records, payments)).toEqual([expect.objectContaining({ basis: "CASH", effect: "REVENUE", amount: "80000", recognizedOn: "2027-06-05", paymentId: payments[0].paymentId })]);
  });
  it("settles the remainder exactly and refuses any overpayment", () => {
    const first = posted(sale, "80000");
    expect(assertPaymentAllocation(scope, payment(sale, "120000"), { paymentMethod: mobileMoney, obligations: [sale] }, [first])[0]).toMatchObject({ outstanding: "0", settlement: "SETTLED" });
    expect(() => assertPaymentAllocation(scope, payment(sale, "120000.0001"), { paymentMethod: mobileMoney, obligations: [sale] }, [first])).toThrow(conflict);
  });
  it("ignores reversed allocations when deriving what is due", () => {
    expect(obligationBalance(sale, [posted(sale, "80000", "REVERSED")])).toMatchObject({ settled: "0", outstanding: "200000", settlement: "OPEN" });
  });
});

describe("payment allocation rules (P04-T001)", () => {
  const parents = { paymentMethod: mobileMoney, obligations: [sale, purchase] };
  it("settles a purchase payable with a payment made", () => {
    expect(assertPaymentAllocation(scope, payment(purchase, "150000", { paidOn: "2027-03-10" }), parents, [])[0]).toMatchObject({ outstanding: "0", settlement: "SETTLED" });
  });
  it.each([
    ["money received against a purchase", payment(purchase, "1000", { direction: "RECEIVED" })],
    ["money paid against a sale", payment(sale, "1000", { direction: "MADE" })],
    ["a different currency", payment(sale, "1000", { currency: "USD" })],
    ["a payment dated before the sale", payment(sale, "1000", { paidOn: "2027-05-31" })],
    ["allocations that do not add up", payment(sale, "1000", { amount: "2000" })],
    ["a repeated record", payment(sale, "1000", { amount: "2000", allocations: [{ obligationId: sale.obligationId, amount: "1000" }, { obligationId: sale.obligationId, amount: "1000" }] })],
    ["no allocation", payment(sale, "1000", { allocations: [] })],
    ["a mismatched payment method", payment(sale, "1000", { paymentMethodId: id() })],
  ])("rejects %s", (_, fields) => {
    expect(() => assertPaymentAllocation(scope, fields, parents, [])).toThrow(invalid);
  });
  it("rejects obligations outside the authorized farm or not looked up", () => {
    expect(() => assertPaymentAllocation(scope, payment(sale, "1000"), { paymentMethod: mobileMoney, obligations: [] }, [])).toThrow(forbidden);
    expect(() => assertPaymentAllocation(scope, payment(sale, "1000"), { paymentMethod: mobileMoney, obligations: [{ ...sale, ...otherFarm }] }, [])).toThrow(forbidden);
  });
  it("rejects settling a reversed record, an archived method or more than is due", () => {
    expect(() => assertPaymentAllocation(scope, payment(sale, "1000"), { paymentMethod: mobileMoney, obligations: [{ ...sale, status: "REVERSED" }] }, [])).toThrow(conflict);
    expect(() => assertPaymentAllocation(scope, payment(sale, "1000"), { paymentMethod: { ...mobileMoney, active: false }, obligations: [sale] }, [])).toThrow(conflict);
    expect(() => assertPaymentAllocation(scope, payment(sale, "80000"), parents, [posted(sale, "150000")])).toThrow(conflict);
  });
  it("treats corrupt allocation history as a conflict, not a balance", () => {
    expect(() => obligationBalance(sale, [posted(sale, "200000.0001")])).toThrow(conflict);
    expect(() => obligationBalance({ ...sale, status: "REVERSED" }, [posted(sale, "1")])).toThrow(conflict);
    expect(() => obligationBalance(sale, [posted(purchase, "1")])).toThrow(invalid);
    expect(obligationBalance({ ...sale, status: "REVERSED" }, [])).toMatchObject({ outstanding: "0", settlement: "VOID" });
  });
});

describe("reversal rules (P04-T001)", () => {
  const target = { ...scope, recordType: "SALE" as const, recordId: sale.obligationId, status: "POSTED" as const };
  it("reverses a posted record once, with a reason", () => {
    expect(() => assertReversal(scope, target, "Entered twice", [])).not.toThrow();
    expect(() => assertReversal(scope, { ...target, status: "REVERSED" }, "Again", [])).toThrow(conflict);
    expect(() => assertReversal(scope, target, "   ", [])).toThrow(invalid);
    expect(() => assertReversal(scope, { ...target, ...otherFarm }, "Entered twice", [])).toThrow(forbidden);
  });
  it("requires payments to be reversed before the sale they settle", () => {
    expect(() => assertReversal(scope, target, "Wrong buyer", [posted(sale, "80000")])).toThrow(conflict);
    expect(() => assertReversal(scope, target, "Wrong buyer", [posted(sale, "80000", "REVERSED")])).not.toThrow();
    expect(() => assertReversal(scope, { ...target, recordType: "PAYMENT", recordId: id() }, "Wrong amount", [posted(sale, "80000")])).not.toThrow();
  });
});

describe("basis recognition (P04-T001)", () => {
  const expense: RecognitionRecord = { recordId: id(), kind: "EXPENSE", amount: "150000", currency: "UGX", occurredOn: "2027-03-10", status: "POSTED" };
  const credit: RecognitionRecord = { recordId: purchase.obligationId, kind: "PURCHASE", amount: "150000", currency: "UGX", occurredOn: "2027-03-10", status: "POSTED" };
  const usdIncome: RecognitionRecord = { recordId: id(), kind: "INCOME", amount: "50", currency: "USD", occurredOn: "2027-04-01", status: "POSTED" };
  const paid: RecognitionPayment = { paymentId: id(), direction: "MADE", paidOn: "2027-04-02", status: "POSTED", allocations: [{ obligationId: credit.recordId, amount: "100000" }] };
  it("counts income and expenses once on both bases because they are settled when recorded", () => {
    for (const basis of ["ACCRUAL", "CASH"] as const) {
      expect(recognizedEvents(basis, [expense, usdIncome], [])).toEqual([
        expect.objectContaining({ effect: "COST", amount: "150000", currency: "UGX", recognizedOn: "2027-03-10" }),
        expect.objectContaining({ effect: "REVENUE", amount: "50", currency: "USD", recognizedOn: "2027-04-01" }),
      ]);
    }
  });
  it("recognizes a credit purchase on its date (accrual) or as paid (cash)", () => {
    expect(recognizedEvents("ACCRUAL", [credit], [paid]).map(event => event.amount)).toEqual(["150000"]);
    expect(recognizedEvents("CASH", [credit], [paid])).toEqual([expect.objectContaining({ effect: "COST", amount: "100000", recognizedOn: "2027-04-02" })]);
  });
  it("excludes reversed records and reversed payments", () => {
    expect(recognizedEvents("ACCRUAL", [{ ...expense, status: "REVERSED" }], [])).toEqual([]);
    expect(recognizedEvents("CASH", [credit], [{ ...paid, status: "REVERSED" }])).toEqual([]);
    expect(recognizedEvents("ACCRUAL", [{ ...credit, status: "REVERSED" }], [{ ...paid, status: "REVERSED" }])).toEqual([]);
  });
  it("refuses incomplete or inconsistent source sets", () => {
    expect(() => recognizedEvents("CASH", [], [paid])).toThrow(invalid);
    expect(() => recognizedEvents("CASH", [credit], [{ ...paid, direction: "RECEIVED" }])).toThrow(invalid);
    expect(() => recognizedEvents("CASH", [expense], [{ ...paid, allocations: [{ obligationId: expense.recordId, amount: "1" }] }])).toThrow(invalid);
    expect(() => recognizedEvents("ACCRUAL", [expense, expense], [])).toThrow(invalid);
    expect(() => recognizedEvents("CASH", [{ ...credit, status: "REVERSED" }], [paid])).toThrow(conflict);
    expect(() => recognizedEvents("NET" as "CASH", [], [])).toThrow(invalid);
  });
  it("orders events deterministically regardless of input order", () => {
    const later = { ...expense, recordId: id(), occurredOn: "2027-05-01" };
    expect(recognizedEvents("ACCRUAL", [later, usdIncome, expense], [])).toEqual(recognizedEvents("ACCRUAL", [expense, later, usdIncome], []));
  });
});
