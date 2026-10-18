import { describe, expect, it } from "vitest";
import { startPoultryBatchSchema } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import { assertPoultryBatchStart, batchLabelKey, currentQuantity, MAX_BIRD_COUNT, normalizeBirdCount, POULTRY_PURPOSES, type PoultryBatchFields, type PoultryBatchParents } from "@/modules/enterprises-seasons/domain/poultry-batch";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const parents: PoultryBatchParents = {
  enterprise: { ...scope, enterpriseId: id(), type: "POULTRY", status: "ACTIVE" },
  animalType: { animalTypeId: id(), name: "Catalog animal", active: true },
};
const fields: PoultryBatchFields = {
  enterpriseId: parents.enterprise.enterpriseId, animalTypeId: parents.animalType.animalTypeId,
  batchLabel: "Batch #004", startingQuantity: 100, acquisitionDate: "2026-03-01", purpose: "EGGS",
};
const command = { ...fields, requestId: id() };
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const forbidden = expect.objectContaining({ code: "FORBIDDEN" });
const conflict = expect.objectContaining({ code: "CONFLICT" });

describe("poultry batch command contract (T007)", () => {
  it("normalizes form strings, label spacing and an omitted breed", () => {
    expect(startPoultryBatchSchema.parse({ ...command, breed: " ", batchLabel: "  Batch   #004 ", startingQuantity: " 0100 " })).toEqual({ ...command, breed: undefined, batchLabel: "Batch #004", startingQuantity: 100 });
    expect(startPoultryBatchSchema.parse({ ...command, breed: "  Kuroiler  " }).breed).toBe("Kuroiler");
  });
  it.each([0, "0", 1, "000", MAX_BIRD_COUNT, String(MAX_BIRD_COUNT)])("accepts the nonnegative whole bird count %j", startingQuantity => {
    expect(startPoultryBatchSchema.parse({ ...command, startingQuantity }).startingQuantity).toBe(Number(startingQuantity));
  });
  it.each([-1, "-1", 0.5, "0.5", "1.0", 1.5, "1e3", "+1", "1,000", "", " ", "abc", NaN, Infinity, MAX_BIRD_COUNT + 1, String(MAX_BIRD_COUNT + 1), "99999999999999999999", null, undefined, true])("rejects fractional, negative, malformed or oversized birds %j", startingQuantity => {
    expect(startPoultryBatchSchema.safeParse({ ...command, startingQuantity }).success).toBe(false);
  });
  it("never returns negative zero", () => {
    expect(Object.is(normalizeBirdCount(-0), 0)).toBe(true);
  });
  it.each(POULTRY_PURPOSES)("accepts the approved purpose %s", purpose => {
    expect(startPoultryBatchSchema.parse({ ...command, purpose }).purpose).toBe(purpose);
  });
  it.each([undefined, "", "eggs", "LAYERS", "OTHER"])("rejects a missing or unapproved purpose %j", purpose => {
    expect(startPoultryBatchSchema.safeParse({ ...command, purpose }).success).toBe(false);
  });
  it.each(["", "   ", "x".repeat(121), undefined, 4])("rejects a blank, overlong or non-text batch label %j", batchLabel => {
    expect(startPoultryBatchSchema.safeParse({ ...command, batchLabel }).success).toBe(false);
  });
  it("rejects an overlong breed", () => {
    expect(startPoultryBatchSchema.safeParse({ ...command, breed: "b".repeat(121) }).success).toBe(false);
  });
  it.each(["2026-02-29", "2026-13-01", "2026-3-1", "01/03/2026", "", undefined])("rejects an impossible or missing acquisition date %j", acquisitionDate => {
    expect(startPoultryBatchSchema.safeParse({ ...command, acquisitionDate }).success).toBe(false);
  });
  it("accepts a leap-day acquisition date", () => {
    expect(startPoultryBatchSchema.parse({ ...command, acquisitionDate: "2028-02-29" }).acquisitionDate).toBe("2028-02-29");
  });
  it.each(["requestId", "enterpriseId", "animalTypeId"])("requires a UUID %s", key => {
    expect(startPoultryBatchSchema.safeParse({ ...command, [key]: "not-a-uuid" }).success).toBe(false);
  });
  it.each(["tenantId", "farmId", "createdBy", "status", "version", "currentQuantity", "currentQuantitySource", "animalTypeName", "acquisitionMethod", "cost"])("rejects the server-owned or unapproved field %s", key => {
    expect(startPoultryBatchSchema.safeParse({ ...command, [key]: key === "version" ? 1 : id() }).success).toBe(false);
  });
});

describe("batch identity (T007)", () => {
  it("treats case and whitespace variants as one farm-wide batch label", () => {
    expect(batchLabelKey("  Batch   #004 ")).toBe(batchLabelKey("batch #004"));
    expect(batchLabelKey("BATCH\t#004")).toBe("batch #004");
  });
  it("keeps distinct labels distinct, including punctuation and digits", () => {
    expect(new Set(["Batch #004", "Batch #04", "Batch 004", "Batch #005", "Batch-004"].map(batchLabelKey)).size).toBe(5);
  });
  it("matches composed and decomposed Unicode spellings", () => {
    expect(batchLabelKey("Kagwé batch")).toBe(batchLabelKey("Kagwé batch"));
  });
});

describe("poultry batch start rule (T007)", () => {
  it("accepts an active POULTRY enterprise and active catalog animal type on the same farm", () => {
    expect(() => assertPoultryBatchStart(scope, fields, parents)).not.toThrow();
    expect(() => assertPoultryBatchStart(scope, { ...fields, startingQuantity: 0 }, parents)).not.toThrow();
  });
  it("rejects wrong farm, wrong tenant and mismatched enterprise IDs as forbidden", () => {
    expect(() => assertPoultryBatchStart({ ...scope, farmId: id() }, fields, parents)).toThrow(forbidden);
    expect(() => assertPoultryBatchStart({ ...scope, tenantId: id() }, fields, parents)).toThrow(forbidden);
    expect(() => assertPoultryBatchStart(scope, { ...fields, enterpriseId: id() }, parents)).toThrow(forbidden);
  });
  it.each(["CROP", "DAIRY", "LIVESTOCK", "FISH", "OTHER"] as const)("rejects a %s enterprise", type => {
    expect(() => assertPoultryBatchStart(scope, fields, { ...parents, enterprise: { ...parents.enterprise, type } })).toThrow(invalid);
  });
  it("rejects a closed enterprise and an inactive catalog animal type as conflicts", () => {
    expect(() => assertPoultryBatchStart(scope, fields, { ...parents, enterprise: { ...parents.enterprise, status: "CLOSED" } })).toThrow(conflict);
    expect(() => assertPoultryBatchStart(scope, fields, { ...parents, animalType: { ...parents.animalType, active: false } })).toThrow(conflict);
  });
  it("rejects a catalog entry that is not the requested animal type", () => {
    expect(() => assertPoultryBatchStart(scope, { ...fields, animalTypeId: id() }, parents)).toThrow(invalid);
  });
  it.each([-1, 1.5, MAX_BIRD_COUNT + 1, NaN])("re-validates bird count %s at the domain boundary", startingQuantity => {
    expect(() => assertPoultryBatchStart(scope, { ...fields, startingQuantity }, parents)).toThrow(invalid);
  });
  it("re-validates date, purpose and label at the domain boundary", () => {
    expect(() => assertPoultryBatchStart(scope, { ...fields, acquisitionDate: "2026-02-30" }, parents)).toThrow(invalid);
    expect(() => assertPoultryBatchStart(scope, { ...fields, purpose: "OTHER" as never }, parents)).toThrow(invalid);
    expect(() => assertPoultryBatchStart(scope, { ...fields, batchLabel: "  " }, parents)).toThrow(invalid);
  });
});

describe("current quantity provenance (T007)", () => {
  it("derives the current count from the starting count and says so", () => {
    expect(currentQuantity(100)).toEqual({ currentQuantity: 100, currentQuantitySource: "STARTING_COUNT" });
    expect(currentQuantity(0)).toEqual({ currentQuantity: 0, currentQuantitySource: "STARTING_COUNT" });
  });
});
