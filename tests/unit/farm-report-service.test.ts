import { describe, expect, it, vi } from "vitest";
import { FarmReportService } from "@/modules/farm-accounting/application/reporting";
import type { FarmReportRepository } from "@/modules/farm-accounting/contracts/accounting";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id(), maize = id(), scope = { tenantId, farmId, actorId };
const now = new Date("2027-12-31T09:00:00.000Z");
function fixture() {
  const authorization: RegistryAuthorization = { account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })), scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })) };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Farm, \"North\"" })) };
  const reports: FarmReportRepository = {
    reportSources: vi.fn(async () => ({ records: [
      { recordId: id(), kind: "SALE" as const, amount: "500000", currency: "UGX", occurredOn: "2027-06-01", status: "POSTED" as const, enterpriseId: maize },
      { recordId: id(), kind: "EXPENSE" as const, amount: "150000", currency: "UGX", occurredOn: "2027-03-10", status: "POSTED" as const, enterpriseId: maize, categoryId: id(), categoryName: "Fertilizer" },
    ], payments: [], enterprises: [{ enterpriseId: maize, name: "Maize" }] })),
    recordExport: vi.fn(async () => undefined),
  };
  return { service: new FarmReportService(authorization, farms, reports, () => now), authorization, farms, reports };
}
describe("farm report service (P04-T011/T014)", () => {
  it("labels basis, range and as-of time and derives the scope from authorization", async () => {
    const { service, reports } = fixture();
    expect(await service.grossMargin(farmId, { basis: "ACCRUAL", from: "2027-01-01", to: "" })).toMatchObject({ basis: "ACCRUAL", from: "2027-01-01", to: null, asOf: now.toISOString(), currencies: [{ currency: "UGX", farm: { grossMargin: "350000" } }] });
    expect(reports.reportSources).toHaveBeenCalledWith(scope, { basis: "ACCRUAL", from: "2027-01-01", to: undefined });
    expect(await service.summary(farmId)).toMatchObject({ basis: "ACCRUAL", currencies: [{ spent: "150000", revenue: "500000", costliest: { enterpriseIds: [maize] } }] });
  });
  it("authenticates and authorizes before parsing filters or reading sources", async () => {
    for (const reason of ["unauthenticated", "farm", "role"]) {
      const { service, authorization, farms, reports } = fixture();
      if (reason === "unauthenticated") vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      for (const call of [() => service.grossMargin(farmId, { basis: "NET" }), () => service.summary(farmId), () => service.exportSummary(farmId)]) await expect(call()).rejects.toMatchObject({ code: reason === "unauthenticated" ? "UNAUTHENTICATED" : "FORBIDDEN" });
      expect(reports.reportSources).not.toHaveBeenCalled(); expect(reports.recordExport).not.toHaveBeenCalled();
    }
  });
  it("rejects forged or invalid filters before reading", async () => {
    const { service, reports } = fixture();
    for (const input of [{ tenantId }, { farmId }, { basis: "NET" }, { from: "2027-02-30" }, { from: "2027-02-02", to: "2027-02-01" }]) await expect(service.summary(farmId, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(reports.reportSources).not.toHaveBeenCalled();
  });
  it("audits an export before returning the CSV, and returns nothing if the audit fails", async () => {
    const { service, reports } = fixture();
    const result = await service.exportSummary(farmId, { basis: "CASH" });
    expect(reports.recordExport).toHaveBeenCalledWith(scope, expect.any(String));
    expect(result.filename).toBe("myfarm-money-summary-cash-start_latest.csv");
    expect(result.csv).toContain("Farm,\"Farm, \"\"North\"\"\"\r\n");
    vi.mocked(reports.recordExport).mockRejectedValue(new FoundationError("FORBIDDEN"));
    await expect(service.exportSummary(farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
