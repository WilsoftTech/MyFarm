import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogReleaseSchema, enterpriseCapabilitySchema } from "@/modules/enterprises-seasons/contracts/catalog";
import { applyCatalogRelease, type CatalogEntry } from "@/modules/enterprises-seasons/domain/catalog";
import { assertCropCycleStart, type CropCycleFields, type CropCycleParents } from "@/modules/enterprises-seasons/domain/crop-cycle";
import { assertPoultryBatchStart, type PoultryBatchFields, type PoultryBatchParents } from "@/modules/enterprises-seasons/domain/poultry-batch";
import { ENTERPRISE_TYPES, ENTERPRISE_WORKFLOWS, displayText, enterpriseWorkflow, hasProductionWorkflow, textKey, type EnterpriseType } from "@/modules/enterprises-seasons/domain/production";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const conflict = expect.objectContaining({ code: "CONFLICT" });
/** Owner-approved crop list for the first reviewed catalog release (D-P03-012). */
const APPROVED_CROPS = ["Beans", "Bananas (matooke)", "Cassava", "Sweet potatoes", "Irish potatoes", "Groundnuts", "Sorghum", "Millet", "Sunflower", "Tea", "Tomatoes", "Cabbage"];
const seeded: CatalogEntry[] = [{ id: "f4030005-0000-4000-8000-000000000001", name: "Maize", active: true }, { id: "f4030005-0000-4000-8000-000000000002", name: "Coffee", active: true }];

function crop(name: string) {
  const parents: CropCycleParents = {
    enterprise: { ...scope, enterpriseId: id(), type: "CROP", status: "ACTIVE" },
    season: { ...scope, seasonId: id(), status: "ACTIVE" },
    plot: { ...scope, plotId: id(), area: "1", areaUnit: "ACRE" },
    crop: { cropId: id(), name, active: true },
  };
  const fields: CropCycleFields = { enterpriseId: parents.enterprise.enterpriseId, seasonId: parents.season.seasonId, plotId: parents.plot.plotId, cropId: parents.crop.cropId, areaPlanted: "0.5", areaUnit: "ACRE", plantingDate: "2026-03-01" };
  return { parents, fields };
}
function poultry(type: EnterpriseType) {
  const parents: PoultryBatchParents = { enterprise: { ...scope, enterpriseId: id(), type, status: "ACTIVE" }, animalType: { animalTypeId: id(), name: "Catalog bird", active: true } };
  const fields: PoultryBatchFields = { enterpriseId: parents.enterprise.enterpriseId, animalTypeId: parents.animalType.animalTypeId, batchLabel: "Batch 1", startingQuantity: 10, acquisitionDate: "2026-03-01", purpose: "MEAT" };
  return { parents, fields };
}

describe("enterprise workflow registry (T010)", () => {
  it("maps every enterprise type exactly once, with workflows only for CROP and POULTRY (D-P03-003)", () => {
    expect(Object.keys(ENTERPRISE_WORKFLOWS).sort()).toEqual([...ENTERPRISE_TYPES].sort());
    expect(Object.fromEntries(ENTERPRISE_TYPES.map(type => [type, enterpriseWorkflow(type)]))).toEqual({ CROP: "CROP_CYCLE", POULTRY: "POULTRY_BATCH", DAIRY: null, LIVESTOCK: null, FISH: null, OTHER: null });
    expect(ENTERPRISE_TYPES.filter(hasProductionWorkflow)).toEqual(["CROP", "POULTRY"]);
    expect(Object.isFrozen(ENTERPRISE_WORKFLOWS)).toBe(true);
  });
  it.each(["constructor", "__proto__", "toString", "crop", ""])("treats an unknown runtime type %j as having no workflow", type => {
    expect(enterpriseWorkflow(type as EnterpriseType)).toBeNull(); expect(hasProductionWorkflow(type as EnterpriseType)).toBe(false);
  });
  it.each(["DAIRY", "LIVESTOCK", "FISH", "OTHER", "POULTRY"] as const)("refuses a crop cycle under a %s enterprise", type => {
    const { parents, fields } = crop("Catalog crop");
    expect(() => assertCropCycleStart(scope, fields, { ...parents, enterprise: { ...parents.enterprise, type } }, [])).toThrow(invalid);
  });
  it.each(["DAIRY", "LIVESTOCK", "FISH", "OTHER", "CROP"] as const)("refuses a poultry batch under a %s enterprise", type => {
    const { parents, fields } = poultry(type);
    expect(() => assertPoultryBatchStart(scope, fields, parents)).toThrow(invalid);
  });
  it("describes availability with a strict capability DTO", () => {
    expect(enterpriseCapabilitySchema.parse({ type: "DAIRY", workflow: null })).toEqual({ type: "DAIRY", workflow: null });
    for (const bad of [{ type: "DAIRY" }, { type: "GOATS", workflow: null }, { type: "CROP", workflow: "HARVEST" }, { type: "CROP", workflow: "CROP_CYCLE", available: true }]) expect(enterpriseCapabilitySchema.safeParse(bad).success).toBe(false);
  });
});

describe("catalog crops need no crop-specific code (T010)", () => {
  it.each(["Maize", ...APPROVED_CROPS, "Ensuku (local banana)", "Crop with a very long but valid name ".padEnd(120, "x")])("starts a cycle for catalog crop %j exactly as for any other", name => {
    const { parents, fields } = crop(name);
    expect(assertCropCycleStart(scope, fields, parents, [])).toEqual({ totalAreaPlanted: "0.5", exceedsPlotArea: false });
    expect(() => assertCropCycleStart(scope, fields, { ...parents, crop: { ...parents.crop, active: false } }, [])).toThrow(conflict);
  });
  it("never branches on seeded catalog names or IDs in application source", () => {
    const files = readdirSync("src", { recursive: true, encoding: "utf8" }).filter(file => /\.(ts|tsx)$/.test(file) && !file.startsWith("generated"));
    expect(files.length).toBeGreaterThan(50);
    const names = ["Maize", "Coffee", ...APPROVED_CROPS, "Chicken", "Duck", "Turkey", "Guinea fowl"].map(name => name.replace(/[()]/g, "\\$&")).join("|");
    const literal = new RegExp(`["'\`](${names})["'\`]`, "i"), seedId = /f40300(05|08)-/i;
    expect(files.filter(file => { const source = readFileSync(join("src", file), "utf8"); return literal.test(source) || seedId.test(source); })).toEqual([]);
  });
});

describe("reviewed catalog releases (T010, D-P03-012)", () => {
  const additions = APPROVED_CROPS.map(name => ({ id: id(), name }));
  it("adds the approved Uganda crops beside Maize and Coffee", () => {
    const result = applyCatalogRelease(seeded, { additions, deactivations: [] });
    expect(result.map(entry => entry.name)).toEqual(["Maize", "Coffee", ...APPROVED_CROPS]);
    expect(result.every(entry => entry.active)).toBe(true);
    expect(new Set(result.map(entry => textKey(entry.name))).size).toBe(14);
  });
  it.each(["maize", "  Coffee", "COFFEE", "Maize "])("rejects or conflicts on a name that duplicates an existing entry: %j", name => {
    expect(() => applyCatalogRelease(seeded, { additions: [{ id: id(), name }], deactivations: [] })).toThrow(name === displayText(name) ? conflict : invalid);
  });
  it("conflicts on reused IDs, duplicates within a release, and names of inactive entries", () => {
    expect(() => applyCatalogRelease(seeded, { additions: [{ id: seeded[0].id, name: "Rice" }], deactivations: [] })).toThrow(conflict);
    expect(() => applyCatalogRelease(seeded, { additions: [{ id: id(), name: "Rice" }, { id: id(), name: "rice" }], deactivations: [] })).toThrow(conflict);
    const retired = [{ ...seeded[0], active: false }, seeded[1]];
    expect(() => applyCatalogRelease(retired, { additions: [{ id: id(), name: "Maize" }], deactivations: [] })).toThrow(conflict);
    expect(() => applyCatalogRelease([...seeded, { id: id(), name: "MAIZE", active: false }], { additions: [], deactivations: [] })).toThrow(conflict);
  });
  it.each(["", " ", "Two  spaces", " Leading", "x".repeat(121), "Tab\tname"])("rejects a blank, unnormalized or overlong name %j", name => {
    expect(() => applyCatalogRelease(seeded, { additions: [{ id: id(), name }], deactivations: [] })).toThrow(invalid);
  });
  it("deactivates existing active entries without deleting them, and refuses unknown or repeated deactivations", () => {
    const result = applyCatalogRelease(seeded, { additions: [], deactivations: [seeded[1].id] });
    expect(result).toEqual([seeded[0], { ...seeded[1], active: false }]);
    for (const deactivations of [[id()], [seeded[1].id, seeded[1].id]]) expect(() => applyCatalogRelease(seeded, { additions: [], deactivations })).toThrow(invalid);
    expect(() => applyCatalogRelease(result, { additions: [], deactivations: [seeded[1].id] })).toThrow(invalid);
    const added = { id: id(), name: "Rice" };
    expect(() => applyCatalogRelease(seeded, { additions: [added], deactivations: [added.id] })).toThrow(invalid);
  });
  it("validates the release shape strictly", () => {
    expect(catalogReleaseSchema.parse({ additions: [{ id: additions[0].id, name: "Beans" }] })).toEqual({ additions: [{ id: additions[0].id, name: "Beans" }], deactivations: [] });
    for (const bad of [{ additions: [{ id: "not-a-uuid", name: "Rice" }] }, { additions: [{ id: id(), name: "Rice", active: false }] }, { additions: [], deletions: [id()] }, { additions: Array.from({ length: 201 }, () => ({ id: id(), name: "x" })) }]) expect(catalogReleaseSchema.safeParse(bad).success).toBe(false);
  });
});

describe("shared text identity", () => {
  it("normalizes display text and keys consistently for labels and catalog names", () => {
    expect(displayText("  Sweet \t potatoes ")).toBe("Sweet potatoes");
    expect(textKey("SWEET  potatoes")).toBe(textKey("sweet potatoes"));
    expect(textKey("Matooké")).toBe(textKey("Matooké"));
  });
});
