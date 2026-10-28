import { describe, expect, it } from "vitest";
import { recordHarvestSchema } from "@/modules/harvest-inventory/contracts/harvest";
import { assertHarvest, normalizeHarvestQuantity, quantityString, quantityUnits, remainingHarvestQuantity, type HarvestParents } from "@/modules/harvest-inventory/domain/harvest";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const command = { requestId: id(), cropCycleId: id(), cropId: id(), plotId: id(), storageLocationId: id(), harvestDate: "2026-10-29", quantity: "2400", unit: "KG", lossQuantity: "150" } as const;
const parents: HarvestParents = {
  cycle: { ...scope, cropCycleId: command.cropCycleId, cropId: command.cropId, plotId: command.plotId, plantingDate: "2026-03-01" },
  plot: { ...scope, plotId: command.plotId },
  storage: { ...scope, storageLocationId: command.storageLocationId, name: "Main store" },
};
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const forbidden = expect.objectContaining({ code: "FORBIDDEN" });

describe("harvest contract", () => {
  it("normalizes decimal strings and grade and defaults initial loss to zero", () => {
    expect(recordHarvestSchema.parse({ ...command, quantity: " 002400.000000 ", grade: "  Grade A  ", lossQuantity: undefined })).toMatchObject({ quantity: "2400", grade: "Grade A", lossQuantity: "0" });
    expect(recordHarvestSchema.parse({ ...command, grade: " " }).grade).toBeUndefined();
  });
  it.each(["0", "0.000000", "-1", "+1", "1e3", "1,000", ".5", "1.", "", "NaN", "Infinity", "1.0000001", "1000000000000", 0.5, null])("rejects invalid harvested quantity %j", quantity => {
    expect(recordHarvestSchema.safeParse({ ...command, quantity }).success).toBe(false);
  });
  it.each(["0.000001", "999999999999.999999"])("preserves exact quantity %s", quantity => {
    expect(recordHarvestSchema.parse({ ...command, quantity, lossQuantity: "0" }).quantity).toBe(quantity);
  });
  it.each(["-1", "2400.000001", "1.0000001", "1e2", null])("rejects invalid initial loss %j", lossQuantity => {
    expect(recordHarvestSchema.safeParse({ ...command, lossQuantity }).success).toBe(false);
  });
  it.each(["BAG", "kg", "EGG", "BIRD", "", undefined])("rejects incompatible or absent unit %j", unit => {
    expect(recordHarvestSchema.safeParse({ ...command, unit }).success).toBe(false);
  });
  it.each(["requestId", "cropCycleId", "cropId", "plotId", "storageLocationId"])("requires UUID %s", field => {
    expect(recordHarvestSchema.safeParse({ ...command, [field]: "wrong" }).success).toBe(false);
  });
  it.each(["farmId", "tenantId", "actorId", "createdBy", "version", "storedQuantity", "income"])("rejects authority/derived field %s", field => {
    expect(recordHarvestSchema.safeParse({ ...command, [field]: id() }).success).toBe(false);
  });
  it.each(["2026-02-29", "2026-04-31", "0000-01-01", "2026-10-29T00:00:00Z"])("rejects invalid date %s", harvestDate => {
    expect(recordHarvestSchema.safeParse({ ...command, harvestDate }).success).toBe(false);
  });
  it("accepts leap day and bounds optional grade", () => {
    expect(recordHarvestSchema.safeParse({ ...command, harvestDate: "2024-02-29", grade: "x".repeat(120) }).success).toBe(true);
    expect(recordHarvestSchema.safeParse({ ...command, grade: "x".repeat(121) }).success).toBe(false);
  });
});

describe("harvest deterministic rules", () => {
  it("keeps gross harvest and initial loss separate, including total loss", () => {
    expect(assertHarvest(scope, command, parents)).toEqual({ storedQuantity: "2250" });
    expect(assertHarvest(scope, { ...command, lossQuantity: "2400" }, parents)).toEqual({ storedQuantity: "0" });
  });
  it("proves the harvest source fixture without mixing the separate inventory example", () => {
    expect(remainingHarvestQuantity("2400", "1600", "150")).toBe("650");
    expect(remainingHarvestQuantity("2400", "1000", "250")).toBe("1150");
  });
  it("subtracts exactly beyond Number safe precision and at six decimal places", () => {
    expect(remainingHarvestQuantity("999999999999.999999", "999999999999.999998", "0")).toBe("0.000001");
    expect(remainingHarvestQuantity("0.3", "0.1", "0.2")).toBe("0");
    expect(quantityString(quantityUnits("001.230000"))).toBe("1.23");
    expect(normalizeHarvestQuantity("1e3")).toBeNull();
  });
  it("rejects negative remaining stock", () => {
    expect(() => remainingHarvestQuantity("2400", "2400", "0.000001")).toThrow(expect.objectContaining({ code: "CONFLICT" }));
    expect(() => quantityString(-1n)).toThrow(invalid);
  });
  it.each(["cycle", "plot", "storage"] as const)("rejects cross-farm/tenant %s", key => {
    for (const changed of [{ farmId: id() }, { tenantId: id() }]) {
      expect(() => assertHarvest(scope, command, { ...parents, [key]: { ...parents[key], ...changed } })).toThrow(forbidden);
    }
  });
  it("rejects nested mismatches within the same farm", () => {
    expect(() => assertHarvest(scope, command, { ...parents, cycle: { ...parents.cycle, cropCycleId: id() } })).toThrow(forbidden);
    expect(() => assertHarvest(scope, command, { ...parents, cycle: { ...parents.cycle, plotId: id() } })).toThrow(forbidden);
    expect(() => assertHarvest(scope, command, { ...parents, plot: { ...parents.plot, plotId: id() } })).toThrow(forbidden);
    expect(() => assertHarvest(scope, command, { ...parents, storage: { ...parents.storage, storageLocationId: id() } })).toThrow(forbidden);
    expect(() => assertHarvest(scope, command, { ...parents, cycle: { ...parents.cycle, cropId: id() } })).toThrow(invalid);
  });
  it("requires a named store and harvest date on or after planting", () => {
    expect(() => assertHarvest(scope, command, { ...parents, storage: { ...parents.storage, name: " " } })).toThrow(invalid);
    expect(() => assertHarvest(scope, { ...command, harvestDate: "2026-02-28" }, parents)).toThrow(invalid);
    expect(assertHarvest(scope, { ...command, harvestDate: parents.cycle.plantingDate }, parents)).toEqual({ storedQuantity: "2250" });
  });
  it("enforces quantity bounds even when called without the DTO parser", () => {
    for (const quantity of ["0", "-1", "1e3", "1.0000001"]) expect(() => assertHarvest(scope, { ...command, quantity }, parents)).toThrow(invalid);
    expect(() => assertHarvest(scope, { ...command, lossQuantity: "2401" }, parents)).toThrow(invalid);
  });
});
