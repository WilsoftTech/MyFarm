import { describe, expect, it } from "vitest";
import { createEnterpriseSchema, createSeasonSchema, cropCycleLinksSchema, poultryBatchLinksSchema, productionPageSchema } from "@/modules/enterprises-seasons/contracts/production";
import { ENTERPRISE_TYPES, assertCropCycleParents, assertPoultryBatchParent, assertSameFarm, hasProductionWorkflow, isCalendarDate, type EnterpriseReference, type FarmScope, type SeasonReference, type PlotReference } from "@/modules/enterprises-seasons/domain/production";

const id = () => crypto.randomUUID();
const scope: FarmScope = { tenantId: id(), farmId: id() };
const enterprise: EnterpriseReference = { ...scope, enterpriseId: id(), type: "CROP", status: "ACTIVE" };
const season: SeasonReference = { ...scope, seasonId: id(), status: "ACTIVE" };
const plot: PlotReference = { ...scope, plotId: id() };
const links = { enterpriseId: enterprise.enterpriseId, seasonId: season.seasonId, plotId: plot.plotId };
const parents = { enterprise, season, plot };

describe("enterprise contracts (P03-T001)", () => {
  it.each(ENTERPRISE_TYPES)("records %s without enabling a later workflow", type => {
    expect(createEnterpriseSchema.parse({ requestId: id(), name: "  Home enterprise  ", type })).toMatchObject({ name: "Home enterprise", type });
    expect(hasProductionWorkflow(type)).toBe(type === "CROP" || type === "POULTRY");
  });
  it.each(["", " ", "x".repeat(121)])("rejects an invalid name %j", name => {
    expect(createEnterpriseSchema.safeParse({ requestId: id(), name, type: "CROP" }).success).toBe(false);
  });
  it("rejects invalid types and unstable/missing request IDs", () => {
    expect(createEnterpriseSchema.safeParse({ requestId: id(), name: "Maize", type: "MAIZE" }).success).toBe(false);
    expect(createEnterpriseSchema.safeParse({ requestId: "retry", name: "Maize", type: "CROP" }).success).toBe(false);
    expect(createEnterpriseSchema.safeParse({ name: "Maize", type: "CROP" }).success).toBe(false);
  });
  it.each(["tenantId", "farmId", "actorId", "createdBy", "role", "status", "version"])("rejects a client authority claim: %s", key => {
    expect(createEnterpriseSchema.safeParse({ requestId: id(), name: "Maize", type: "CROP", [key]: id() }).success).toBe(false);
    expect(createSeasonSchema.safeParse({ requestId: id(), label: "Season A", startDate: "2026-03-01", [key]: id() }).success).toBe(false);
  });
});

describe("farm-level season contracts", () => {
  it("permits overlapping seasons: overlap is not a uniqueness rule", () => {
    for (const label of ["Season A", "Season B"]) {
      expect(createSeasonSchema.parse({ requestId: id(), label, startDate: "2026-03-01", endDate: "2026-08-01" })).toMatchObject({ label });
    }
  });
  it("allows an omitted end date and normalizes an empty form field", () => {
    for (const endDate of [undefined, ""]) {
      expect(createSeasonSchema.parse({ requestId: id(), label: "  Season A  ", startDate: "2026-03-01", endDate })).toMatchObject({ label: "Season A", endDate: undefined });
    }
  });
  it("allows same-day dates and rejects a reversed range at the end date field", () => {
    expect(createSeasonSchema.safeParse({ requestId: id(), label: "A", startDate: "2026-03-01", endDate: "2026-03-01" }).success).toBe(true);
    const result = createSeasonSchema.safeParse({ requestId: id(), label: "A", startDate: "2026-03-01", endDate: "2026-02-28" });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["endDate"] })]));
  });
  it.each(["2026-02-29", "1900-02-29", "2026-04-31", "2026-00-10", "2026-13-01", "2026-03-00", "0000-01-01", "2026-3-01", "2026-03-01T00:00:00Z", "not-a-date"])("rejects impossible/non-calendar date %s", value => {
    expect(isCalendarDate(value)).toBe(false);
    expect(createSeasonSchema.safeParse({ requestId: id(), label: "A", startDate: value }).success).toBe(false);
    expect(createSeasonSchema.safeParse({ requestId: id(), label: "A", startDate: "2026-01-01", endDate: value }).success).toBe(false);
  });
  it.each(["2024-02-29", "2000-02-29", "0001-01-01", "9999-12-31"])("accepts calendar date %s without timezone conversion", value => expect(isCalendarDate(value)).toBe(true));
});

describe("production relationships and farm separation", () => {
  it("validates UUID relationships and rejects arrays or extra scope fields", () => {
    expect(cropCycleLinksSchema.parse(links)).toEqual(links);
    expect(cropCycleLinksSchema.safeParse({ ...links, plotId: [plot.plotId] }).success).toBe(false);
    expect(cropCycleLinksSchema.safeParse({ ...links, seasonId: undefined }).success).toBe(false);
    expect(cropCycleLinksSchema.safeParse({ ...links, farmId: scope.farmId }).success).toBe(false);
    expect(poultryBatchLinksSchema.parse({ enterpriseId: enterprise.enterpriseId })).toEqual({ enterpriseId: enterprise.enterpriseId });
  });
  it("supports several cycles across plots and seasons for the same crop enterprise", () => {
    for (let n = 0; n < 3; n++) {
      const nextPlot = { ...plot, plotId: id() }, nextSeason = { ...season, seasonId: id() };
      expect(() => assertCropCycleParents(scope, { enterpriseId: enterprise.enterpriseId, seasonId: nextSeason.seasonId, plotId: nextPlot.plotId }, { enterprise, season: nextSeason, plot: nextPlot })).not.toThrow();
    }
  });
  it.each(["enterprise", "season", "plot"] as const)("rejects another farm's %s even within the same tenant", parent => {
    expect(() => assertCropCycleParents(scope, links, { ...parents, [parent]: { ...parents[parent], farmId: id() } })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it.each(["enterprise", "season", "plot"] as const)("rejects another tenant's %s even with a forged matching farm ID", parent => {
    expect(() => assertCropCycleParents(scope, links, { ...parents, [parent]: { ...parents[parent], tenantId: id() } })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it.each(["enterpriseId", "seasonId", "plotId"] as const)("rejects mismatched lookup results for %s inside the same farm", field => {
    expect(() => assertCropCycleParents(scope, { ...links, [field]: id() }, parents)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it("keeps two farms' production parent sets separate", () => {
    const otherScope = { ...scope, farmId: id() };
    const other = { enterprise: { ...enterprise, ...otherScope, enterpriseId: id() }, season: { ...season, ...otherScope, seasonId: id() }, plot: { ...plot, ...otherScope, plotId: id() } };
    const otherLinks = { enterpriseId: other.enterprise.enterpriseId, seasonId: other.season.seasonId, plotId: other.plot.plotId };
    expect(() => assertCropCycleParents(scope, links, parents)).not.toThrow();
    expect(() => assertCropCycleParents(otherScope, otherLinks, other)).not.toThrow();
    expect(() => assertCropCycleParents(scope, otherLinks, other)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it("rejects a poultry enterprise as a crop parent, and a closed season for new cycles", () => {
    expect(() => assertCropCycleParents(scope, links, { ...parents, enterprise: { ...enterprise, type: "POULTRY" } })).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    expect(() => assertCropCycleParents(scope, links, { ...parents, season: { ...season, status: "CLOSED" } })).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it("does not start crop or poultry production in a closed enterprise", () => {
    expect(() => assertCropCycleParents(scope, links, { ...parents, enterprise: { ...enterprise, status: "CLOSED" } })).toThrow(expect.objectContaining({ code: "CONFLICT" }));
    const closedPoultry: EnterpriseReference = { ...enterprise, type: "POULTRY", status: "CLOSED" };
    expect(() => assertPoultryBatchParent(scope, { enterpriseId: closedPoultry.enterpriseId }, closedPoultry)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it("allows poultry only in its own enterprise and scope", () => {
    const poultry: EnterpriseReference = { ...enterprise, type: "POULTRY" };
    expect(() => assertPoultryBatchParent(scope, { enterpriseId: poultry.enterpriseId }, poultry)).not.toThrow();
    expect(() => assertPoultryBatchParent(scope, { enterpriseId: poultry.enterpriseId }, { ...poultry, farmId: id() })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => assertPoultryBatchParent(scope, { enterpriseId: id() }, poultry)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => assertPoultryBatchParent(scope, { enterpriseId: enterprise.enterpriseId }, enterprise)).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
  it("generic scope checks compare both tenant and farm", () => {
    expect(() => assertSameFarm(scope, [scope])).not.toThrow();
    expect(() => assertSameFarm(scope, [{ ...scope, tenantId: id() }])).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});

describe("bounded production lists", () => {
  it("reuses registry cursor pagination without allowing scope injection", () => {
    expect(productionPageSchema.parse({})).toEqual({ limit: 20 });
    expect(productionPageSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(productionPageSchema.safeParse({ cursor: "other-farm" }).success).toBe(false);
    expect(productionPageSchema.safeParse({ tenantId: scope.tenantId }).success).toBe(false);
  });
});
