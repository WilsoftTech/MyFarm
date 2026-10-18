import { describe, expect, it, vi } from "vitest";
import { ProductionService, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/production";
import type { ProductionRepository, EnterpriseView, SeasonView } from "@/modules/enterprises-seasons/contracts/production";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";

const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id(), enterpriseId = id(), seasonId = id();
const metadata = { farmId, tenantId, createdBy: actorId, createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z", version: 1, status: "ACTIVE" as const };
const enterprise: EnterpriseView = { ...metadata, enterpriseId, name: "Maize", type: "CROP" };
const season: SeasonView = { ...metadata, seasonId, label: "Season A", startDate: "2026-03-01", endDate: null };
const enterpriseInput = () => ({ requestId: id(), name: "Maize", type: "CROP" });
const seasonInput = () => ({ requestId: id(), label: "Season A", startDate: "2026-03-01" });
function fixture() {
  const authorization: RegistryAuthorization = {
    account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })),
    scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })),
  };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId })) };
  const repository: ProductionRepository = {
    enterprise: vi.fn(async () => enterprise), season: vi.fn(async () => season), plot: vi.fn(async () => null),
    enterprises: vi.fn(async () => ({ items: [enterprise], nextCursor: null })),
    seasons: vi.fn(async () => ({ items: [season], nextCursor: null })),
    createEnterprise: vi.fn(async () => enterprise), createSeason: vi.fn(async () => season),
  };
  return { service: new ProductionService(authorization, farms, repository), authorization, farms, repository };
}

describe("production service authorization", () => {
  it("authenticates before any input validation or farm/production lookup", async () => {
    const { service, authorization, farms, repository } = fixture();
    vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    for (const work of [() => service.listEnterprises("bad", { limit: 0 }), () => service.listSeasons("bad"), () => service.enterprise("bad", "bad"), () => service.season("bad", "bad"), () => service.createEnterprise("bad", {}), () => service.createSeason("bad", {})]) {
      await expect(work()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    }
    expect(farms.farmScopeForMember).not.toHaveBeenCalled();
    for (const method of Object.values(repository)) expect(method).not.toHaveBeenCalled();
  });
  it("denies missing/foreign farms before reading or writing production data", async () => {
    const { service, farms, repository } = fixture();
    vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
    await expect(service.listEnterprises(farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.createSeason(farmId, seasonInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.enterprises).not.toHaveBeenCalled(); expect(repository.createSeason).not.toHaveBeenCalled();
  });
  it("reuses active farm membership and FARMER-only organization scope", async () => {
    const { service, farms, authorization, repository } = fixture();
    const input = enterpriseInput();
    await service.createEnterprise(farmId, input);
    expect(farms.farmScopeForMember).toHaveBeenCalledWith({ userId: actorId, farmId });
    expect(authorization.scope).toHaveBeenCalledWith(tenantId, ["FARMER"]);
    expect(repository.createEnterprise).toHaveBeenCalledWith({ actorId, tenantId, farmId }, input);
  });
  it("denies a changed identity between authorization checks", async () => {
    const { service, authorization, repository } = fixture();
    vi.mocked(authorization.scope).mockResolvedValue({ actorId: id(), organizationId: tenantId, role: "FARMER" });
    await expect(service.createEnterprise(farmId, enterpriseInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.createEnterprise).not.toHaveBeenCalled();
  });
  it("rechecks membership on every call, including a retry", async () => {
    const { service, authorization, repository } = fixture();
    const input = enterpriseInput(); await service.createEnterprise(farmId, input);
    vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
    await expect(service.createEnterprise(farmId, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.createEnterprise).toHaveBeenCalledTimes(1);
  });
  it("does not reveal whether a nested production ID exists in another farm", async () => {
    const { service, repository } = fixture();
    vi.mocked(repository.enterprise).mockResolvedValue(null); vi.mocked(repository.season).mockResolvedValue(null);
    await expect(service.enterprise(farmId, enterpriseId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.season(farmId, seasonId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.enterprise).toHaveBeenCalledWith({ actorId, farmId, tenantId }, enterpriseId);
  });
  it.each(["tenantId", "farmId", "actorId", "createdBy", "status", "version"])("rejects client authority field %s", async key => {
    const { service, repository } = fixture();
    await expect(service.createEnterprise(farmId, { ...enterpriseInput(), [key]: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.createSeason(farmId, { ...seasonInput(), [key]: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.createEnterprise).not.toHaveBeenCalled(); expect(repository.createSeason).not.toHaveBeenCalled();
  });
  it("validates IDs and season ranges before repository effects", async () => {
    const { service, repository } = fixture();
    await expect(service.enterprise(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.season(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.listSeasons("bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.createSeason(farmId, { ...seasonInput(), endDate: "2025-01-01" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.season).not.toHaveBeenCalled(); expect(repository.createSeason).not.toHaveBeenCalled();
  });
});

describe("production pagination boundary", () => {
  it("passes bounded cursor pages to the authorized repository", async () => {
    const { service, repository } = fixture();
    await expect(service.listSeasons(farmId)).resolves.toEqual({ items: [season], nextCursor: null });
    await service.listEnterprises(farmId, { cursor: enterpriseId, limit: 10 });
    expect(repository.enterprises).toHaveBeenCalledWith({ actorId, farmId, tenantId }, { cursor: enterpriseId, limit: 10 });
    await expect(service.season(farmId, seasonId)).resolves.toEqual(season);
    await expect(service.enterprise(farmId, enterpriseId)).resolves.toEqual(enterprise);
    await expect(service.createSeason(farmId, seasonInput())).resolves.toEqual(season);
  });
  it.each(["limit=51", "limit=no", "limit=2&limit=3", "cursor=bad", "tenantId=forged", "farmId=forged", "__proto__=forged"])("rejects malformed or unscoped query %s", async query => {
    const { service, repository } = fixture();
    const page = productionPageInput(new Request("http://localhost/enterprises?" + query));
    await expect(service.listEnterprises(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.enterprises).not.toHaveBeenCalled();
  });
});
