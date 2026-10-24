import { describe, expect, it } from "vitest";
import { startPoultryBatchSchema } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import { MAX_BIRD_COUNT, assertPoultryBatchStart, currentBatchQuantity, normalizeBirdCount, type PoultryBatchFields } from "@/modules/enterprises-seasons/domain/poultry-batch";
import { ENTERPRISE_TYPES, type EnterpriseReference } from "@/modules/enterprises-seasons/domain/production";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const enterprise: EnterpriseReference = { ...scope, enterpriseId: id(), type: "POULTRY", status: "ACTIVE" };
const fields: PoultryBatchFields = {
  enterpriseId: enterprise.enterpriseId, batchName: "Batch 1", animalType: "Chicken",
  startingQuantity: 300, acquisitionDate: "2026-03-01", purpose: "Layers",
};
const command = { ...fields, startingQuantity: "300", requestId: id() };
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const forbidden = expect.objectContaining({ code: "FORBIDDEN" });

describe("poultry-batch command contract (T007)", () => {
  it("normalizes form inputs, whole-number spelling and an omitted breed", () => {
    expect(startPoultryBatchSchema.parse({ ...command, batchName: "  Batch 1 ", startingQuantity: " 000300 ", breed: " " })).toEqual({ ...fields, requestId: command.requestId, breed: undefined });
    expect(startPoultryBatchSchema.parse({ ...command, breed: "  Kuroiler  " }).breed).toBe("Kuroiler");
  });
  it.each(["0", "00", "1", String(MAX_BIRD_COUNT)])("accepts nonnegative whole bird count %s", startingQuantity => {
    expect(startPoultryBatchSchema.parse({ ...command, startingQuantity }).startingQuantity).toBe(Number(startingQuantity));
  });
  it.each(["-1", "-0", "+1", "1.5", "1.0", "0.5", "1e3", "1,000", "1 000", "", "NaN", "Infinity", "0x10", String(MAX_BIRD_COUNT + 1), "10000000000", 300, 1.5, -1, null])("rejects fractional, negative, malformed or oversized bird count %j", startingQuantity => {
    expect(startPoultryBatchSchema.safeParse({ ...command, startingQuantity }).success).toBe(false);
  });
  it.each(["requestId", "enterpriseId"])("requires a UUID for %s", key => {
    for (const value of [undefined, "", "poultry", [id()]]) expect(startPoultryBatchSchema.safeParse({ ...command, [key]: value }).success).toBe(false);
  });
  it.each(["batchName", "animalType", "purpose"])("requires bounded text for %s", key => {
    for (const value of [undefined, "", "   ", "x".repeat(121), 7]) expect(startPoultryBatchSchema.safeParse({ ...command, [key]: value }).success).toBe(false);
    expect(startPoultryBatchSchema.safeParse({ ...command, [key]: "x".repeat(120) }).success).toBe(true);
  });
  it("bounds the optional breed", () => {
    expect(startPoultryBatchSchema.safeParse({ ...command, breed: "x".repeat(120) }).success).toBe(true);
    expect(startPoultryBatchSchema.safeParse({ ...command, breed: "x".repeat(121) }).success).toBe(false);
  });
  it.each(["tenantId", "farmId", "actorId", "createdBy", "status", "version", "batchId", "currentQuantity", "seasonId", "plotId"])("rejects forged authority, derived or unsupported field %s", key => {
    expect(startPoultryBatchSchema.safeParse({ ...command, [key]: id() }).success).toBe(false);
  });
  it.each(["2026-02-29", "1900-02-29", "2026-04-31", "0000-01-01", "2026-03-01T12:00:00Z", "2026-3-01", ""])("rejects invalid acquisition date %j", acquisitionDate => {
    expect(startPoultryBatchSchema.safeParse({ ...command, acquisitionDate }).success).toBe(false);
  });
  it("accepts a leap-day acquisition date", () => {
    expect(startPoultryBatchSchema.parse({ ...command, acquisitionDate: "2024-02-29" }).acquisitionDate).toBe("2024-02-29");
  });
});

describe("poultry-batch deterministic start rules", () => {
  it("accepts a batch in its own active poultry enterprise, including zero starting birds", () => {
    expect(() => assertPoultryBatchStart(scope, fields, enterprise)).not.toThrow();
    expect(() => assertPoultryBatchStart(scope, { ...fields, startingQuantity: 0 }, enterprise)).not.toThrow();
  });
  it("rejects cross-farm, cross-tenant and mismatched enterprise lookups", () => {
    for (const override of [{ farmId: id() }, { tenantId: id() }]) expect(() => assertPoultryBatchStart(scope, fields, { ...enterprise, ...override })).toThrow(forbidden);
    expect(() => assertPoultryBatchStart(scope, { ...fields, enterpriseId: id() }, enterprise)).toThrow(forbidden);
  });
  it.each(ENTERPRISE_TYPES.filter(type => type !== "POULTRY"))("rejects a %s enterprise as a poultry batch parent", type => {
    expect(() => assertPoultryBatchStart(scope, fields, { ...enterprise, type })).toThrow(invalid);
  });
  it("rejects a closed enterprise", () => {
    expect(() => assertPoultryBatchStart(scope, fields, { ...enterprise, status: "CLOSED" })).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it.each([-1, 1.5, 0.1, MAX_BIRD_COUNT + 1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid domain bird count %s without coercion", startingQuantity => {
    expect(() => assertPoultryBatchStart(scope, { ...fields, startingQuantity }, enterprise)).toThrow(invalid);
  });
  it("rejects blank required text and impossible dates in domain inputs", () => {
    for (const key of ["batchName", "animalType", "purpose"] as const) expect(() => assertPoultryBatchStart(scope, { ...fields, [key]: "  " }, enterprise)).toThrow(invalid);
    expect(() => assertPoultryBatchStart(scope, { ...fields, acquisitionDate: "2026-02-30" }, enterprise)).toThrow(invalid);
  });
});

describe("poultry-batch current quantity provenance", () => {
  it("derives current quantity from the starting count and says so", () => {
    expect(currentBatchQuantity({ startingQuantity: 300 })).toEqual({ quantity: 300, source: "STARTING_QUANTITY" });
    expect(currentBatchQuantity({ startingQuantity: 0 })).toEqual({ quantity: 0, source: "STARTING_QUANTITY" });
  });
  it("rejects an invalid stored count instead of reporting it", () => {
    for (const startingQuantity of [-1, 2.5, Number.NaN]) expect(() => currentBatchQuantity({ startingQuantity })).toThrow(invalid);
  });
  it("normalizes bird counts exactly", () => {
    expect(normalizeBirdCount("0042")).toBe(42);
    expect(normalizeBirdCount("4.2")).toBeNull();
  });
});
