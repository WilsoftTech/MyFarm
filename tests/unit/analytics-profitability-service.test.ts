import { describe, expect, it, vi } from "vitest";
import { FarmProfitabilityService } from "@/modules/analytics-profitability/application/profitability";
import type { DashboardSeasons, MetricFacts, MetricFactsRepository } from "@/modules/analytics-profitability/contracts/profitability";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id(), scope = { tenantId, farmId, actorId }, active = id(), closed = id();
const now = new Date("2027-12-31T09:00:00.000Z");
const season = (seasonId: string, status: "ACTIVE" | "CLOSED", startDate: string) => ({ seasonId, label: startDate, status, startDate, endDate: null });
function fixture() {
  const authorization: RegistryAuthorization = {
    account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })),
    scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })),
  };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Farm" })) };
  const reports = { reportSources: vi.fn(async () => ({ records: [
    { recordId: id(), kind: "EXPENSE" as const, amount: "70", currency: "UGX", occurredOn: "2027-03-10", status: "POSTED" as const, seasonId: active },
    { recordId: id(), kind: "EXPENSE" as const, amount: "30", currency: "UGX", occurredOn: "2027-03-11", status: "POSTED" as const },
  ], payments: [], enterprises: [] })) };
  const seasons: DashboardSeasons = {
    seasons: vi.fn(async () => [season(closed, "CLOSED", "2027-06-01"), season(active, "ACTIVE", "2027-03-01")]),
    season: vi.fn(async () => null),
  };
  const facts: MetricFactsRepository = { facts: vi.fn(async (): Promise<MetricFacts> => ({ cycles: [], enterprises: [], batches: [], items: [], costGroups: [] })) };
  return { service: new FarmProfitabilityService(authorization, farms, reports, seasons, facts, () => now), authorization, farms, reports, seasons, facts };
}

describe("farm dashboard service (P08-T002)", () => {
  it("derives the scope from authorization and labels the view", async () => {
    const { service, reports } = fixture();
    expect(await service.dashboard(farmId)).toMatchObject({ basis: "ACCRUAL", asOf: now.toISOString(), season: { seasonId: active }, currencies: [{ expenses: "70" }], notLinkedToSeason: [{ currency: "UGX", revenue: "0", costs: "30" }] });
    expect(reports.reportSources).toHaveBeenCalledWith(scope, { basis: "ACCRUAL", from: undefined, to: undefined });
  });
  it("uses no season when dates or all records are chosen", async () => {
    const { service } = fixture();
    for (const input of [{ seasonId: "all" }, { from: "2027-01-01" }]) expect(await service.dashboard(farmId, input)).toMatchObject({ season: null, currencies: [{ expenses: "100" }], notLinkedToSeason: [] });
  });
  it("finds a chosen season past the listed ones, under the same farm scope", async () => {
    const { service, seasons } = fixture(), older = id();
    vi.mocked(seasons.season).mockResolvedValue(season(older, "CLOSED", "2001-01-01"));
    expect((await service.dashboard(farmId, { seasonId: older })).season?.seasonId).toBe(older);
    expect(seasons.season).toHaveBeenCalledWith(scope, older);
  });
  it("authenticates and authorizes before parsing filters or reading anything", async () => {
    for (const reason of ["unauthenticated", "farm", "role"]) {
      const { service, authorization, farms, reports, seasons } = fixture();
      if (reason === "unauthenticated") vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      await expect(service.dashboard(farmId, { basis: "NET" })).rejects.toMatchObject({ code: reason === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN" });
      expect(reports.reportSources).not.toHaveBeenCalled();
      expect(seasons.seasons).not.toHaveBeenCalled();
    }
  });
  it("metrics authorizes and validates before reading anything, and uses the same scope", async () => {
    for (const reason of ["unauthenticated", "farm", "role"]) {
      const { service, authorization, farms, reports, facts } = fixture();
      if (reason === "unauthenticated") vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      await expect(service.metrics(farmId, { basis: "NET" })).rejects.toMatchObject({ code: reason === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN" });
      expect(reports.reportSources).not.toHaveBeenCalled();
      expect(facts.facts).not.toHaveBeenCalled();
    }
    const { service, facts } = fixture();
    await service.metrics(farmId);
    expect(facts.facts).toHaveBeenCalledWith(scope, active);
    await service.metrics(farmId, { seasonId: "all" });
    expect(facts.facts).toHaveBeenLastCalledWith(scope, null);
  });
  it("trends authorize and validate before reading anything, and read every season's facts (P08-T008)", async () => {
    for (const reason of ["unauthenticated", "farm", "role", "filter"]) {
      const { service, authorization, farms, reports, facts } = fixture();
      if (reason === "unauthenticated") vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      await expect(service.trends(farmId, { basis: reason === "filter" ? "NET" : "ACCRUAL", ...(reason === "filter" ? {} : { tenantId: id() }) })).rejects.toMatchObject({ code: reason === "unauthenticated" ? "UNAUTHENTICATED" : reason === "filter" ? "INVALID_INPUT" : "FORBIDDEN" });
      expect(reports.reportSources).not.toHaveBeenCalled();
      expect(facts.facts).not.toHaveBeenCalled();
    }
    const { service, facts, reports } = fixture();
    expect(await service.trends(farmId)).toMatchObject({ season: { seasonId: active }, cropsNeedSeason: false, crops: [], batches: [], asOf: now.toISOString() });
    expect(facts.facts).toHaveBeenCalledWith(scope, null);
    expect(reports.reportSources).toHaveBeenCalledWith(scope, { basis: "ACCRUAL", from: undefined, to: undefined });
    expect(await service.trends(farmId, { from: "2027-01-01" })).toMatchObject({ season: null, cropsNeedSeason: true, crops: [] });
    expect(reports.reportSources).toHaveBeenLastCalledWith(scope, { basis: "ACCRUAL", from: undefined, to: undefined });
  });
  it("trends compare a season opened past the listed ones with the listed seasons before it", async () => {
    const { service, seasons, facts } = fixture(), oldest = id(), maize = id();
    vi.mocked(seasons.season).mockResolvedValue(season(oldest, "CLOSED", "2020-01-01"));
    const cycle = (seasonId: string) => ({ cycleId: id(), seasonId, enterpriseId: id(), cropId: maize, cropName: "Maize", areaPlanted: "1", areaUnit: "ACRE" as const, status: "CLOSED" as const, harvestedKg: "10", lostKg: "0" });
    vi.mocked(facts.facts).mockResolvedValue({ cycles: [cycle(oldest), cycle(active)], enterprises: [], batches: [], items: [], costGroups: [] });
    expect((await service.trends(farmId, { seasonId: oldest })).crops).toMatchObject([{ season: { seasonId: oldest }, unavailable: "NO_EARLIER_SEASON" }]);
    expect((await service.trends(farmId, { seasonId: active })).crops).toMatchObject([{ earlierSeason: null }]);
  });
  it("refuses a season it cannot find without reading any money", async () => {
    const { service, reports } = fixture();
    await expect(service.dashboard(farmId, { seasonId: id() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reports.reportSources).not.toHaveBeenCalled();
  });
  it("rejects invalid filters before reading", async () => {
    const { service, reports } = fixture();
    for (const input of [{ basis: "NET" }, { tenantId: id() }, { seasonId: active, from: "2027-01-01" }]) await expect(service.dashboard(farmId, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(reports.reportSources).not.toHaveBeenCalled();
  });
});
