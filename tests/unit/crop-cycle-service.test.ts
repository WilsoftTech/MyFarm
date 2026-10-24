import { describe, expect, it, vi } from "vitest";
import { CropCycleService } from "@/modules/enterprises-seasons/application/crop-cycle";
import type { CropCycleRepository, CropCycleView } from "@/modules/enterprises-seasons/contracts/crop-cycle";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id();
const input = { requestId: id(), enterpriseId: id(), seasonId: id(), plotId: id(), cropId: id(), areaPlanted: "00.100000", areaUnit: "ACRE", plantingDate: "2026-03-01", variety: " " };
const row: CropCycleView = { ...input, areaUnit: "ACRE", cycleId: id(), farmId, tenantId, areaPlanted: "0.1", variety: null, expectedHarvest: null, areaExceptionReason: null, cropName: "Maize", status: "ACTIVE", version: 1, createdBy: actorId, createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z" };
function fixture() {
  const authorization: RegistryAuthorization = { account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })), scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })) };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Farm" })) };
  const repository: CropCycleRepository = { plots: vi.fn(async () => ({ items: [], nextCursor: null })), plot: vi.fn(async () => null), startCropCycle: vi.fn(async () => row), cropCycle: vi.fn(async (): Promise<CropCycleView | null> => row), cropCycles: vi.fn(async () => ({ items: [row], nextCursor: null })), crops: vi.fn(async () => ({ items: [{ cropId: input.cropId, name: "Maize" }], nextCursor: null })) };
  return { service: new CropCycleService(authorization, farms, repository), authorization, farms, repository };
}
describe("crop-cycle service", () => {
  it("authorizes plot choices/detail and validates IDs/pagination without broad farm data", async () => {
    const { service, repository, authorization } = fixture();
    await service.plots(farmId);
    expect(repository.plots).toHaveBeenCalledWith({ tenantId, farmId, actorId }, { limit: 20 });
    await expect(service.plot(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.plot(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.plots(farmId, { limit: 51 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
    await expect(service.plots(farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.plot(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.plots).toHaveBeenCalledTimes(1); expect(repository.plot).toHaveBeenCalledTimes(1);
  });
  it("normalizes commands and derives scope from current authorization", async () => {
    const { service, repository, authorization } = fixture();
    await expect(service.start(farmId, input)).resolves.toEqual(row);
    expect(authorization.scope).toHaveBeenCalledWith(tenantId, ["FARMER"]);
    expect(repository.startCropCycle).toHaveBeenCalledWith({ actorId, tenantId, farmId }, expect.objectContaining({ areaPlanted: "0.1", variety: undefined }));
  });
  it("authenticates before input, pagination and ID validation", async () => {
    const { service, authorization, farms, repository } = fixture();
    vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    for (const call of [() => service.start("bad", {}), () => service.cycle("bad", "bad"), () => service.list("bad", {}), () => service.crops("bad", {})]) await expect(call()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(farms.farmScopeForMember).not.toHaveBeenCalled();
    expect(repository.startCropCycle).not.toHaveBeenCalled(); expect(repository.crops).not.toHaveBeenCalled();
  });
  it("denies missing membership, disallowed tenant role and changed identity", async () => {
    for (const reason of ["farm", "role", "identity"]) {
      const { service, authorization, farms, repository } = fixture();
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      if (reason === "identity") vi.mocked(authorization.scope).mockResolvedValue({ actorId: id(), organizationId: tenantId, role: "FARMER" });
      for (const call of [() => service.start(farmId, input), () => service.cycle(farmId, row.cycleId), () => service.list(farmId), () => service.crops(farmId)]) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repository.startCropCycle).not.toHaveBeenCalled(); expect(repository.cropCycle).not.toHaveBeenCalled(); expect(repository.cropCycles).not.toHaveBeenCalled(); expect(repository.crops).not.toHaveBeenCalled();
    }
  });
  it.each(["tenantId", "farmId", "actorId", "status", "version"])("rejects a forged %s without calling the write port", async key => {
    const { service, repository } = fixture();
    await expect(service.start(farmId, { ...input, [key]: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.startCropCycle).not.toHaveBeenCalled();
  });
  it("scopes detail/list/catalog calls, default pagination and unknown nested IDs", async () => {
    const { service, repository } = fixture();
    await expect(service.cycle(farmId, row.cycleId)).resolves.toEqual(row);
    await service.list(farmId); await service.crops(farmId, { limit: 1 });
    expect(repository.cropCycle).toHaveBeenCalledWith({ tenantId, farmId, actorId }, row.cycleId);
    expect(repository.cropCycles).toHaveBeenCalledWith({ tenantId, farmId, actorId }, { limit: 20 });
    expect(repository.crops).toHaveBeenCalledWith({ tenantId, farmId, actorId }, { limit: 1 });
    vi.mocked(repository.cropCycle).mockResolvedValue(null);
    await expect(service.cycle(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects malformed IDs and unbounded/forged pagination", async () => {
    const { service, repository } = fixture();
    await expect(service.cycle(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    for (const page of [{ limit: 51 }, { limit: 0 }, { cursor: "bad" }, { tenantId }]) {
      await expect(service.list(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(service.crops(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(repository.cropCycle).not.toHaveBeenCalled(); expect(repository.cropCycles).not.toHaveBeenCalled();
  });
});
