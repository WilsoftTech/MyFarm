import { describe, expect, it } from "vitest";
import { startCropCycleSchema } from "@/modules/enterprises-seasons/contracts/crop-cycle";
import { assertCropCycleStart, normalizePlantedArea, type CropAreaAllocation, type CropCycleFields, type CropCycleParents } from "@/modules/enterprises-seasons/domain/crop-cycle";
import { AREA_UNITS } from "@/modules/farmer-registry/domain/rules";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const parents: CropCycleParents = {
  enterprise: { ...scope, enterpriseId: id(), type: "CROP", status: "ACTIVE" },
  season: { ...scope, seasonId: id(), status: "ACTIVE" },
  plot: { ...scope, plotId: id(), area: "1", areaUnit: "ACRE" },
  crop: { cropId: id(), name: "Catalog crop", active: true },
};
const fields: CropCycleFields = {
  enterpriseId: parents.enterprise.enterpriseId, seasonId: parents.season.seasonId, plotId: parents.plot.plotId,
  cropId: parents.crop.cropId, areaPlanted: "0.5", areaUnit: "ACRE", plantingDate: "2026-03-01",
};
const command = { ...fields, requestId: id() };
const allocation = (areaPlanted: string): CropAreaAllocation => ({ ...scope, cycleId: id(), plotId: fields.plotId, areaPlanted, areaUnit: "ACRE", status: "ACTIVE" });
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const forbidden = expect.objectContaining({ code: "FORBIDDEN" });

describe("crop-cycle command contract (T004)", () => {
  it("normalizes form inputs, decimal spelling and omitted optional fields", () => {
    expect(startCropCycleSchema.parse({ ...command, variety: "  Local variety  ", areaPlanted: " 0000.500000 ", expectedHarvest: "", areaExceptionReason: " " })).toEqual({ ...command, areaPlanted: "0.5", variety: "Local variety", expectedHarvest: undefined, areaExceptionReason: undefined });
    expect(startCropCycleSchema.parse(command)).toMatchObject(fields);
  });
  it("preserves an explicit exception reason and optional variety", () => {
    expect(startCropCycleSchema.parse({ ...command, variety: "", areaExceptionReason: "  Intercropping overlap recorded by owner  " })).toMatchObject({ variety: undefined, areaExceptionReason: "Intercropping overlap recorded by owner" });
  });
  it.each(["0", "0.000000", "-1", "+1", "1e3", "1,000", ".5", "1.", "NaN", "Infinity", "", "1.0000001", "1000000000000", 0.5, null])("rejects nonpositive, malformed or overprecision area %j", areaPlanted => {
    expect(startCropCycleSchema.safeParse({ ...command, areaPlanted }).success).toBe(false);
  });
  it.each(["0.000001", "999999999999.999999"])("retains exact boundary area %s", areaPlanted => {
    expect(startCropCycleSchema.parse({ ...command, areaPlanted }).areaPlanted).toBe(areaPlanted);
  });
  it.each(AREA_UNITS)("accepts the existing explicit unit %s", areaUnit => {
    expect(startCropCycleSchema.parse({ ...command, areaUnit }).areaUnit).toBe(areaUnit);
  });
  it.each([undefined, "", "BAG", "acre"])("rejects a missing/unknown unit %j", areaUnit => {
    expect(startCropCycleSchema.safeParse({ ...command, areaUnit }).success).toBe(false);
  });
  it.each(["requestId", "enterpriseId", "seasonId", "plotId", "cropId"])("requires a UUID for %s", key => {
    for (const value of [undefined, "", "maize", [id()]]) expect(startCropCycleSchema.safeParse({ ...command, [key]: value }).success).toBe(false);
  });
  it.each(["tenantId", "farmId", "actorId", "createdBy", "status", "version", "cropName", "approvedBy", "totalAreaPlanted"])("rejects forged authority or derived field %s", key => {
    expect(startCropCycleSchema.safeParse({ ...command, [key]: id() }).success).toBe(false);
  });
  it.each(["2026-02-29", "1900-02-29", "2026-04-31", "0000-01-01", "2026-03-01T12:00:00Z", "2026-3-01"])("rejects invalid agricultural date %s in either field", date => {
    expect(startCropCycleSchema.safeParse({ ...command, plantingDate: date }).success).toBe(false);
    expect(startCropCycleSchema.safeParse({ ...command, expectedHarvest: date }).success).toBe(false);
  });
  it("allows same-day harvest, leap days and an open perennial, rejecting a reversed range at its field", () => {
    for (const expectedHarvest of [undefined, "", command.plantingDate, "2026-08-01"]) expect(startCropCycleSchema.safeParse({ ...command, expectedHarvest }).success).toBe(true);
    expect(startCropCycleSchema.safeParse({ ...command, plantingDate: "2024-02-29", expectedHarvest: "2024-02-29" }).success).toBe(true);
    const reversed = startCropCycleSchema.safeParse({ ...command, expectedHarvest: "2026-02-28" });
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["expectedHarvest"] })]));
  });
  it("bounds optional variety and recorded exception reason", () => {
    expect(startCropCycleSchema.safeParse({ ...command, variety: "x".repeat(120), areaExceptionReason: "x".repeat(500) }).success).toBe(true);
    expect(startCropCycleSchema.safeParse({ ...command, variety: "x".repeat(121) }).success).toBe(false);
    expect(startCropCycleSchema.safeParse({ ...command, areaExceptionReason: "x".repeat(501) }).success).toBe(false);
  });
});

describe("crop-cycle deterministic start rules", () => {
  it("accepts exact intercropping capacity using decimal arithmetic (0.1 + 0.2 = 0.3)", () => {
    expect(assertCropCycleStart(scope, { ...fields, areaPlanted: "0.2" }, { ...parents, plot: { ...parents.plot, area: "0.3" } }, [allocation("0.1")])).toEqual({ totalAreaPlanted: "0.3", exceedsPlotArea: false });
  });
  it("requires a new recorded reason when aggregate area exceeds capacity by one millionth", () => {
    const occupied = [allocation("0.500001")];
    for (const areaExceptionReason of [undefined, "", "   "]) expect(() => assertCropCycleStart(scope, { ...fields, areaExceptionReason }, parents, occupied)).toThrow(invalid);
    expect(assertCropCycleStart(scope, { ...fields, areaExceptionReason: "Owner records intercropping overlap" }, parents, occupied)).toEqual({ totalAreaPlanted: "1.000001", exceedsPlotArea: true });
  });
  it("also checks a first cycle larger than the plot, including a zero-size plot", () => {
    for (const area of ["0", "0.1"]) {
      const context = { ...parents, plot: { ...parents.plot, area } };
      expect(() => assertCropCycleStart(scope, fields, context, [])).toThrow(invalid);
      expect(assertCropCycleStart(scope, { ...fields, areaExceptionReason: "Recorded area exception" }, context, []).exceedsPlotArea).toBe(true);
    }
  });
  it("sums large areas beyond floating-point safe precision without rounding", () => {
    const huge = { ...fields, areaPlanted: "999999999999.999998", areaExceptionReason: "Recorded overlap" };
    const context = { ...parents, plot: { ...parents.plot, area: "999999999999.999999" } };
    expect(assertCropCycleStart(scope, huge, context, [allocation("0.000001")])).toEqual({ totalAreaPlanted: "999999999999.999999", exceedsPlotArea: false });
    expect(assertCropCycleStart(scope, huge, context, [allocation("0.000002")])).toEqual({ totalAreaPlanted: "1000000000000", exceedsPlotArea: true });
  });
  it("counts every active allocation across seasons/enterprises, but not closed cycles", () => {
    expect(() => assertCropCycleStart(scope, fields, parents, [allocation("0.3"), allocation("0.3")])).toThrow(invalid);
    expect(assertCropCycleStart(scope, fields, parents, [{ ...allocation("100"), status: "CLOSED" }])).toEqual({ totalAreaPlanted: "0.5", exceedsPlotArea: false });
  });
  it("allows open perennials and dates outside the season label without assuming forecast closure", () => {
    expect(assertCropCycleStart(scope, fields, parents, []).exceedsPlotArea).toBe(false);
    expect(assertCropCycleStart(scope, { ...fields, plantingDate: "2000-01-01", expectedHarvest: "2030-01-01" }, parents, []).exceedsPlotArea).toBe(false);
    expect(() => assertCropCycleStart(scope, { ...fields, expectedHarvest: "2026-02-28" }, parents, [])).toThrow(invalid);
  });
  it.each(["enterprise", "season", "plot"] as const)("rejects cross-farm/tenant or mismatched %s lookup", key => {
    for (const override of [{ farmId: id() }, { tenantId: id() }]) expect(() => assertCropCycleStart(scope, fields, { ...parents, [key]: { ...parents[key], ...override } }, [])).toThrow(forbidden);
    const links = { ...fields, [key + "Id"]: id() };
    expect(() => assertCropCycleStart(scope, links, parents, [])).toThrow(forbidden);
  });
  it("rejects wrong enterprise type or closed production parents", () => {
    expect(() => assertCropCycleStart(scope, fields, { ...parents, enterprise: { ...parents.enterprise, type: "POULTRY" } }, [])).toThrow(invalid);
    for (const key of ["enterprise", "season"] as const) expect(() => assertCropCycleStart(scope, fields, { ...parents, [key]: { ...parents[key], status: "CLOSED" } }, [])).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it("requires the selected active data-catalog crop, without hard-coded crop names", () => {
    expect(() => assertCropCycleStart(scope, fields, { ...parents, crop: { ...parents.crop, cropId: id() } }, [])).toThrow(invalid);
    expect(() => assertCropCycleStart(scope, fields, { ...parents, crop: { ...parents.crop, active: false } }, [])).toThrow(expect.objectContaining({ code: "CONFLICT" }));
    const crop = { cropId: id(), name: "New catalog entry", active: true };
    expect(() => assertCropCycleStart(scope, { ...fields, cropId: crop.cropId }, { ...parents, crop }, [])).not.toThrow();
  });
  it.each([{ area: null, areaUnit: null }, { area: "1", areaUnit: null }, { area: null, areaUnit: "ACRE" as const }])("fails closed on unknown or incomplete plot area %j, even with a reason", plot => {
    expect(() => assertCropCycleStart(scope, { ...fields, areaExceptionReason: "Cannot bypass unknown area" }, { ...parents, plot: { ...parents.plot, ...plot } }, [])).toThrow(invalid);
  });
  it("never converts or sums mismatched units, even with an exception reason", () => {
    const withReason = { ...fields, areaExceptionReason: "Cannot bypass unit checks" };
    expect(() => assertCropCycleStart(scope, { ...withReason, areaUnit: "HECTARE" }, parents, [])).toThrow(invalid);
    expect(() => assertCropCycleStart(scope, withReason, parents, [{ ...allocation("0.1"), areaUnit: "SQUARE_METRE" }])).toThrow(invalid);
  });
  it("rejects foreign allocation data and duplicate rows instead of returning a misleading total", () => {
    for (const override of [{ farmId: id() }, { tenantId: id() }, { plotId: id() }]) expect(() => assertCropCycleStart(scope, fields, parents, [{ ...allocation("0.1"), ...override }])).toThrow(forbidden);
    const row = allocation("0.1");
    expect(() => assertCropCycleStart(scope, fields, parents, [row, row])).toThrow(invalid);
  });
  it("rejects invalid area in domain inputs without coercion", () => {
    for (const area of ["0", "-1", "0.0000001", "NaN"]) {
      expect(() => assertCropCycleStart(scope, { ...fields, areaPlanted: area }, parents, [])).toThrow(invalid);
      expect(() => assertCropCycleStart(scope, fields, parents, [allocation(area)])).toThrow(invalid);
    }
    expect(() => assertCropCycleStart(scope, fields, { ...parents, plot: { ...parents.plot, area: "-1" } }, [])).toThrow(invalid);
    expect(normalizePlantedArea("0001.250000")).toBe("1.25");
  });
});
