import { describe, expect, it, vi } from "vitest";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import type { AccountingRecordView, FarmAccountingRepository, PaymentView } from "@/modules/farm-accounting/contracts/accounting";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id(), scope = { tenantId, farmId, actorId };
const expense = { requestId: id(), categoryId: id(), amount: "0150000.00", currency: "ugx", occurredOn: "2027-03-10", counterparty: " ABC  Agro ", paymentMethodId: id() };
const paymentInput = { requestId: id(), direction: "RECEIVED", amount: "80000", currency: "UGX", paidOn: "2027-06-05", paymentMethodId: id(), allocations: [{ obligationId: id(), amount: "80000" }] };
const reversal = { requestId: id(), recordType: "SALE", recordId: id(), reason: " Entered twice " };
const meta = { version: 1, createdBy: actorId, createdAt: "2026-10-25T00:00:00Z", updatedAt: "2026-10-25T00:00:00Z" };
const record: AccountingRecordView = { ...meta, recordId: id(), tenantId, farmId, kind: "EXPENSE", categoryId: expense.categoryId, categoryName: "Fertilizer", amount: "150000", currency: "UGX", occurredOn: "2027-03-10", counterparty: "ABC Agro", paymentMethodId: expense.paymentMethodId, plotId: null, enterpriseId: null, seasonId: null, status: "POSTED", reversal: null, balance: null, payments: [] };
const payment: PaymentView = { ...meta, paymentId: id(), tenantId, farmId, direction: "RECEIVED", amount: "80000", currency: "UGX", paidOn: "2027-06-05", paymentMethodId: paymentInput.paymentMethodId, externalReference: null, status: "POSTED", reversal: null, allocations: paymentInput.allocations };
function fixture() {
  const authorization: RegistryAuthorization = { account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })), scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })) };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Farm" })) };
  const repository: FarmAccountingRepository = {
    categories: vi.fn(async () => ({ items: [], nextCursor: null })), paymentMethods: vi.fn(async () => ({ items: [], nextCursor: null })),
    record: vi.fn(async (): Promise<AccountingRecordView | null> => record), records: vi.fn(async () => ({ items: [record], nextCursor: null })),
    payment: vi.fn(async (): Promise<PaymentView | null> => payment), recordTransaction: vi.fn(async () => record), recordPayment: vi.fn(async () => payment),
    reverse: vi.fn(async () => ({ recordType: "SALE" as const, recordId: reversal.recordId, reversal: { reason: "Entered twice", reversedBy: actorId, reversedAt: meta.createdAt } })),
  };
  return { service: new FarmAccountingService(authorization, farms, repository), authorization, farms, repository };
}
const writes = (service: FarmAccountingService) => [
  () => service.recordTransaction("EXPENSE", farmId, expense), () => service.recordTransaction("SALE", farmId, { ...expense, paymentMethodId: undefined }),
  () => service.recordPayment(farmId, paymentInput), () => service.reverse(farmId, reversal),
];
const reads = (service: FarmAccountingService) => [
  () => service.categories(farmId), () => service.paymentMethods(farmId), () => service.records(farmId), () => service.record(farmId, record.recordId), () => service.payment(farmId, payment.paymentId),
];
const untouched = (repository: FarmAccountingRepository) => { for (const fn of Object.values(repository)) expect(fn).not.toHaveBeenCalled(); };

describe("farm accounting service (P04-T002)", () => {
  it("normalizes commands and derives tenant, farm and actor from current authorization", async () => {
    const { service, repository, authorization } = fixture();
    await expect(service.recordTransaction("EXPENSE", farmId, expense)).resolves.toEqual(record);
    expect(authorization.scope).toHaveBeenCalledWith(tenantId, ["FARMER"]);
    expect(repository.recordTransaction).toHaveBeenCalledWith(scope, "EXPENSE", expect.objectContaining({ amount: "150000", currency: "UGX", counterparty: "ABC Agro" }));
    await service.recordPayment(farmId, paymentInput); await service.reverse(farmId, reversal);
    expect(repository.recordPayment).toHaveBeenCalledWith(scope, expect.objectContaining({ amount: "80000", direction: "RECEIVED" }));
    expect(repository.reverse).toHaveBeenCalledWith(scope, expect.objectContaining({ reason: "Entered twice" }));
  });
  it("applies the kind-specific schema: sales and purchases carry no payment method", async () => {
    const { service, repository } = fixture();
    for (const kind of ["SALE", "PURCHASE"] as const) await expect(service.recordTransaction(kind, farmId, expense)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await service.recordTransaction("INCOME", farmId, expense);
    expect(repository.recordTransaction).toHaveBeenCalledTimes(1);
    await expect(service.recordTransaction("NET" as "SALE", farmId, expense)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("authenticates before any input, pagination or ID validation", async () => {
    const { service, authorization, farms, repository } = fixture();
    vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    for (const call of [...writes(service), ...reads(service), () => service.record("bad", "bad"), () => service.records("bad", { limit: 99 })]) await expect(call()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(farms.farmScopeForMember).not.toHaveBeenCalled(); untouched(repository);
  });
  it("denies missing membership, a disallowed tenant role and a changed identity", async () => {
    for (const reason of ["farm", "role", "identity"]) {
      const { service, authorization, farms, repository } = fixture();
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      if (reason === "identity") vi.mocked(authorization.scope).mockResolvedValue({ actorId: id(), organizationId: tenantId, role: "FARMER" });
      for (const call of [...writes(service), ...reads(service)]) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      untouched(repository);
    }
  });
  it.each(["tenantId", "farmId", "actorId", "kind", "status", "version", "balance", "categoryName", "activityId"])("rejects a forged %s without calling the write port", async key => {
    const { service, repository } = fixture();
    await expect(service.recordTransaction("EXPENSE", farmId, { ...expense, [key]: key === "version" ? 1 : id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.recordPayment(farmId, { ...paymentInput, [key]: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    untouched(repository);
  });
  it("rejects float-like, unbalanced and unreasoned commands before the write port", async () => {
    const { service, repository } = fixture();
    for (const amount of [0.1, "1e5", "150,000", "-1", "0"]) await expect(service.recordTransaction("EXPENSE", farmId, { ...expense, amount })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.recordPayment(farmId, { ...paymentInput, amount: "100000" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.reverse(farmId, { ...reversal, reason: " " })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    untouched(repository);
  });
  it("scopes reads, applies default pagination and hides unknown nested IDs", async () => {
    const { service, repository } = fixture();
    await service.records(farmId); await service.categories(farmId, { kind: "COST", limit: 50 }); await service.paymentMethods(farmId);
    expect(repository.records).toHaveBeenCalledWith(scope, { limit: 20 });
    expect(repository.categories).toHaveBeenCalledWith(scope, { kind: "COST", limit: 50 });
    expect(repository.paymentMethods).toHaveBeenCalledWith(scope, { limit: 20 });
    vi.mocked(repository.record).mockResolvedValue(null); vi.mocked(repository.payment).mockResolvedValue(null);
    await expect(service.record(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.payment(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects malformed IDs and unbounded or forged pagination", async () => {
    const { service, repository } = fixture();
    await expect(service.record(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.payment(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    for (const page of [{ limit: 51 }, { limit: 0 }, { cursor: "bad" }, { tenantId }]) {
      await expect(service.records(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(service.categories(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    await expect(service.categories(farmId, { kind: "TAX" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    untouched(repository);
  });
});

describe("settling one sale or purchase from the screen (P04-T003)", () => {
  const sale: AccountingRecordView = { ...record, kind: "SALE", categoryName: "Crop sales", amount: "200000", paymentMethodId: null,
    balance: { obligationId: record.recordId, amount: "200000", currency: "UGX", settled: "0", outstanding: "200000", settlement: "OPEN" } };
  const form = { requestId: id(), amount: "080000", paidOn: "2027-06-05", paymentMethodId: paymentInput.paymentMethodId, externalReference: " MM-1 " };
  it("derives direction, currency and the single allocation from the authorized record", async () => {
    for (const [kind, direction] of [["SALE", "RECEIVED"], ["PURCHASE", "MADE"]] as const) {
      const { service, repository } = fixture();
      vi.mocked(repository.record).mockResolvedValue({ ...sale, kind, currency: "USD" });
      await service.settle(farmId, record.recordId, form);
      expect(repository.record).toHaveBeenCalledWith(scope, record.recordId);
      expect(repository.recordPayment).toHaveBeenCalledWith(scope, { requestId: form.requestId, direction, amount: "80000", currency: "USD", paidOn: "2027-06-05", paymentMethodId: form.paymentMethodId, externalReference: "MM-1", allocations: [{ obligationId: record.recordId, amount: "80000" }] });
    }
  });
  it("refuses client-chosen direction, currency or allocations and income/expense targets", async () => {
    for (const key of ["direction", "currency", "allocations", "obligationId", "tenantId"]) {
      const { service, repository } = fixture();
      await expect(service.settle(farmId, record.recordId, { ...form, [key]: "RECEIVED" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
      untouched(repository);
    }
    const { service, repository } = fixture();
    await expect(service.settle(farmId, record.recordId, form)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.recordPayment).not.toHaveBeenCalled();
    vi.mocked(repository.record).mockResolvedValue(null);
    await expect(service.settle(farmId, id(), form)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.settle(farmId, "bad", form)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.recordPayment).not.toHaveBeenCalled();
  });
  it("authenticates and authorizes before reading the record", async () => {
    const { service, authorization, repository } = fixture();
    vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    await expect(service.settle("bad", "bad", {})).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    untouched(repository);
  });
});
