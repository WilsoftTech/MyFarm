import { describe, expect, it } from "vitest";
import { activityTypeSchema } from "@/modules/farm-activities/contracts/catalog";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, WORKFLOW_ACTIVITIES, activityCapabilities, activityUnavailableReason, assertActivityAllowed, type ActivityType } from "@/modules/farm-activities/domain/catalog";
import { ENTERPRISE_TYPES, type EnterpriseType } from "@/modules/enterprises-seasons/domain/production";

const crop: ActivityType[] = ["PLANTING", "IRRIGATION", "WEEDING", "SPRAYING", "FERTILIZING", "HARVESTING", "PRUNING", "INSPECTION"];
const poultry: ActivityType[] = ["VACCINATION", "FEEDING", "CLEANING", "INSPECTION"];
const unsupported: EnterpriseType[] = ["DAIRY", "LIVESTOCK", "FISH", "OTHER"];

describe("MYF-P06-R001 activity catalog", () => {
  it("retains every source activity and the recurring cleaning activity", () => {
    expect([...ACTIVITY_TYPES].sort()).toEqual(["CLEANING", "FEEDING", "FERTILIZING", "HARVESTING", "INSPECTION", "IRRIGATION", "MILKING", "PLANTING", "PRUNING", "SPRAYING", "VACCINATION", "WEEDING"]);
    expect(new Set(ACTIVITY_TYPES).size).toBe(ACTIVITY_TYPES.length);
    expect(Object.keys(ACTIVITY_LABELS).sort()).toEqual([...ACTIVITY_TYPES].sort());
  });
  it("freezes the catalog and workflow rules against runtime changes", () => {
    expect(Object.isFrozen(ACTIVITY_TYPES)).toBe(true);
    expect(Object.isFrozen(WORKFLOW_ACTIVITIES)).toBe(true);
    expect(Object.isFrozen(WORKFLOW_ACTIVITIES.CROP_CYCLE)).toBe(true);
    expect(Object.isFrozen(WORKFLOW_ACTIVITIES.POULTRY_BATCH)).toBe(true);
  });
  it("accepts catalog values only", () => {
    for (const type of ACTIVITY_TYPES) expect(activityTypeSchema.parse(type)).toBe(type);
    for (const value of ["planting", "PLANTING ", "", "MOWING", "constructor", null, 1]) expect(activityTypeSchema.safeParse(value).success).toBe(false);
  });
});

describe("MYF-P06-AC001 crop and poultry behavior", () => {
  it.each(ACTIVITY_TYPES)("applies the explicit crop rule to %s", type => {
    expect(activityUnavailableReason(type, "CROP")).toBe(crop.includes(type) ? null : type === "MILKING" ? "NO_MVP_WORKFLOW" : "NOT_FOR_THIS_ENTERPRISE");
  });
  it.each(ACTIVITY_TYPES)("applies the explicit poultry rule to %s", type => {
    expect(activityUnavailableReason(type, "POULTRY")).toBe(poultry.includes(type) ? null : type === "MILKING" ? "NO_MVP_WORKFLOW" : "NOT_FOR_THIS_ENTERPRISE");
  });
  it("keeps milking in the catalog without offering it before a dairy workflow exists", () => {
    for (const type of [...ENTERPRISE_TYPES, null]) expect(activityUnavailableReason("MILKING", type)).toBe("NO_MVP_WORKFLOW");
  });
  it.each(unsupported)("refuses %s enterprises with a clear reason rather than a dead workflow", type => {
    for (const activity of ACTIVITY_TYPES.filter(value => value !== "MILKING")) {
      expect(activityUnavailableReason(activity, type)).toBe("ENTERPRISE_NOT_SUPPORTED");
      expect(() => assertActivityAllowed(activity, type)).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
    }
  });
  it("allows farm-level work for every activity with an MVP workflow", () => {
    for (const type of ACTIVITY_TYPES) expect(activityUnavailableReason(type, null)).toBe(type === "MILKING" ? "NO_MVP_WORKFLOW" : null);
  });
  it.each(["constructor", "__proto__", "toString", "UNKNOWN"])("treats runtime enterprise value %s as unsupported", value => {
    expect(activityUnavailableReason("INSPECTION", value as EnterpriseType)).toBe("ENTERPRISE_NOT_SUPPORTED");
  });
  it("treats an unknown runtime activity as unavailable", () => {
    expect(activityUnavailableReason("MOWING" as ActivityType, "CROP")).toBe("NO_MVP_WORKFLOW");
  });
  it("lists the whole catalog with availability for the chosen enterprise", () => {
    const capabilities = activityCapabilities("POULTRY");
    expect(capabilities.map(capability => capability.type)).toEqual([...ACTIVITY_TYPES]);
    expect(capabilities.filter(capability => capability.available).map(capability => capability.type).sort()).toEqual([...poultry].sort());
    expect(capabilities.find(capability => capability.type === "PLANTING")).toEqual({ type: "PLANTING", label: "Planting", available: false, reason: "NOT_FOR_THIS_ENTERPRISE" });
    expect(activityCapabilities("FISH").some(capability => capability.available)).toBe(false);
  });
  it("accepts an allowed activity without side effects", () => {
    expect(() => assertActivityAllowed("FERTILIZING", "CROP")).not.toThrow();
    expect(() => assertActivityAllowed("FEEDING", "POULTRY")).not.toThrow();
    expect(() => assertActivityAllowed("INSPECTION", null)).not.toThrow();
  });
});
