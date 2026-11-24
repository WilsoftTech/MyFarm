import { describe, it, expect, vi } from "vitest";
import { procurementTotal, organizationReport, declaredForecasts } from "@/modules/cooperatives/domain/operations";
import { createCooperativeSchema, relationshipCommandSchema, operationCommandSchema, type LotView, type EntryView, type CooperativeRepository } from "@/modules/cooperatives/contracts/cooperative";
import { CooperativeService } from "@/modules/cooperatives/application/cooperative";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const id = () => crypto.randomUUID();
const lot = (extra: Partial<LotView> = {}): LotView => ({ id: id(), shareId: id(), harvestId: null, product: "Maize", unit: "KG", quantity: "10", unitPrice: "2", currency: "UGX", total: "20", grade: "", occurredOn: "2026-11-24", published: false, version: 1, ...extra });
const entry = (l: LotView, extra: Partial<EntryView> = {}): EntryView => ({ id: id(), lotId: l.id, product: l.product, unit: l.unit, currency: l.currency, operationId: l.id, kind: "STOCK", location: "Store", quantityDelta: l.quantity, amountDelta: "0", occurredOn: l.occurredOn, reason: "PROCUREMENT", reversalOfId: null, ...extra });
describe("cooperative exact procurement and ledger conservation", () => {
  it("multiplies exactly and rounds once, half up to four money places", () => {
    expect(procurementTotal("0.1", "0.3", "KG")).toBe("0.03");
    expect(procurementTotal("0.5", "0.0001", "KG")).toBe("0.0001");
    expect(procurementTotal("3.333333", "6000", "KG")).toBe("19999.998");
  });
  it.each([["0", "1", "KG"], ["0.5", "1", "EGG"], ["0.5", "1", "BIRD"], ["1", "1", "BAG"], ["0.000001", "0.0001", "KG"], ["999999999999", "9999999999999999", "KG"]])("rejects invalid, zero-rounding and overflowing totals %s %s %s", (q, price, unit) => {
    expect(() => procurementTotal(q, price, unit)).toThrow(FoundationError);
  });
  it("reconstructs two stores and payments without treating payment as stock or profit", () => {
    const l = lot(), e = entry(l);
    const state = organizationReport([l], [e, entry(l, { operationId: id(), quantityDelta: "-4" }), entry(l, { operationId: id(), location: "Depot", quantityDelta: "4" }), entry(l, { operationId: id(), kind: "PAYMENT", location: "", quantityDelta: "0", amountDelta: "7" })]);
    expect(state.inventory.map(row => row.quantity)).toEqual(["6", "4"]);
    expect(state.payments).toEqual([{ lotId: l.id, currency: "UGX", obligation: "20", paid: "7", outstanding: "13" }]);
  });
  it("refuses negative effective-date stock even if later receipts make today's balance positive", () => {
    const l = lot();
    expect(() => organizationReport([l], [entry(l), entry(l, { quantityDelta: "-1", occurredOn: "2026-11-23" })])).toThrow(FoundationError);
  });
  it("refuses overpayment and unbalanced entry dimensions", () => {
    const l = lot();
    expect(() => organizationReport([l], [entry(l), entry(l, { kind: "PAYMENT", location: "", quantityDelta: "0", amountDelta: "21" })])).toThrow(FoundationError);
    expect(() => organizationReport([l], [entry(l, { amountDelta: "1" })])).toThrow(FoundationError);
  });
  it("requires payments reversed before the procurement obligation can be reversed", () => {
    const l = lot(), receipt = entry(l), payment = entry(l, { operationId: id(), kind: "PAYMENT", location: "", quantityDelta: "0", amountDelta: "5" });
    const reversed = entry(l, { operationId: id(), quantityDelta: "-10", reversalOfId: receipt.id });
    expect(() => organizationReport([l], [receipt, payment, reversed])).toThrow(FoundationError);
    expect(organizationReport([l], [receipt, payment, reversed, { ...payment, id: id(), operationId: id(), amountDelta: "-5", reversalOfId: payment.id }]).payments[0].outstanding).toBe("0");
  });
  it("cannot mistake user-entered release reasons for a procurement source", () => {
    const l = lot(), acquisition = entry(l), release = entry(l, { operationId: id(), quantityDelta: "-2", reason: "PROCUREMENT" });
    expect(organizationReport([l], [acquisition, release, { ...release, id: id(), operationId: id(), quantityDelta: "2", reversalOfId: release.id }]).payments[0].obligation).toBe("20");
  });
  it("never combines currencies across procurement records", () => {
    const a = lot(), b = lot({ currency: "USD" });
    expect(organizationReport([a, b], [entry(a), entry(b)]).payments.map(p => p.currency)).toEqual(["UGX", "USD"]);
  });
  it("aggregates collected produce only for matching products, units and stores, retaining individual origins", () => {
    const a = lot(), b = lot(), eggs = lot({ product: "Eggs", unit: "EGG" });
    const result = organizationReport([a, b, eggs], [entry(a), entry(b), entry(eggs)]);
    expect(result.inventoryAggregates).toEqual([{ product: "Maize", unit: "KG", location: "Store", quantity: "20" }, { product: "Eggs", unit: "EGG", location: "Store", quantity: "10" }]);
    expect(result.inventory).toHaveLength(3);
  });
});
describe("declared forecast boundaries and strict commands", () => {
  const forecast = { id: id(), shareId: id(), product: "Maize", unit: "KG", quantity: "0.1", harvestFrom: "2026-12-01", harvestTo: "2026-12-31", version: 1 };
  it("totals matching estimates exactly, keeping windows/products/units separate", () => {
    const totals = declaredForecasts([forecast, { ...forecast, id: id(), quantity: "0.2" }, { ...forecast, unit: "EGG", quantity: "2" }, { ...forecast, harvestTo: "2027-01-01" }]);
    expect(totals.map(t => t.quantity)).toEqual(["0.3", "2", "0.1"]);
  });
  it("rejects backwards windows and fractional birds", () => {
    expect(() => declaredForecasts([{ ...forecast, harvestFrom: "2027-01-01" }])).toThrow();
    expect(() => declaredForecasts([{ ...forecast, unit: "BIRD" }])).toThrow();
  });
  it("requires explicit confirmation and refuses forged authority or private-finance sharing", () => {
    const command = { type: "SHARE", requestId: id(), farmId: id(), shareLocation: false, shareProduction: true, confirmed: true };
    expect(relationshipCommandSchema.safeParse(command).success).toBe(true);
    for (const extra of [{ confirmed: false }, { userId: id() }, { tenantId: id() }, { shareFinance: true }, { role: "MANAGER" }]) expect(relationshipCommandSchema.safeParse({ ...command, ...extra }).success).toBe(false);
  });
  it("canonicalizes UUID casing so retries and concurrent writes share one lock namespace", () => {
    const organizationId = id(), requestId = id();
    expect(createCooperativeSchema.parse({ requestId: requestId.toUpperCase(), organizationId: organizationId.toUpperCase(), name: "Co-op", confirmed: true })).toMatchObject({ organizationId, requestId });
  });
  it("does not expose payment execution, custody or automatic predictions as commands", () => {
    for (const type of ["PAY_OUT", "WALLET", "SETTLE", "CUSTODY", "PREDICT"]) expect(operationCommandSchema.safeParse({ type, requestId: id(), confirmed: true }).success).toBe(false);
    expect(createCooperativeSchema.safeParse({ requestId: id(), organizationId: id(), name: "Co-op", confirmed: true, ownerId: id() }).success).toBe(false);
  });
  it("authenticates before validating or touching a repository, including anonymous malformed requests", async () => {
    const auth = { account: vi.fn(async () => { throw new FoundationError("UNAUTHENTICATED"); }), scope: vi.fn() };
    const repository: CooperativeRepository = { list: vi.fn(), create: vi.fn(), relationship: vi.fn(), operation: vi.fn(), read: vi.fn() };
    const service = new CooperativeService(auth, repository);
    await expect(service.operation("invalid", {})).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(service.create({})).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(repository.operation).not.toHaveBeenCalled(); expect(repository.create).not.toHaveBeenCalled();
  });
});
