import { describe, expect, it, vi } from "vitest";
import { PoultryBatchService } from "@/modules/enterprises-seasons/application/poultry-batch";
import type { PoultryBatchRepository, PoultryBatchView } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id();
const input = { requestId: id(), enterpriseId: id(), animalTypeId: id(), breed: " ", batchLabel: " Batch   #004 ", startingQuantity: "0100", acquisitionDate: "2026-03-01", purpose: "EGGS" };
const row: PoultryBatchView = { enterpriseId: input.enterpriseId, animalTypeId: input.animalTypeId, batchId: id(), farmId, tenantId, animalTypeName: "Chicken", breed: null, batchLabel: "Batch #004", startingQuantity: 100, currentQuantity: 100, currentQuantitySource: "STARTING_COUNT", acquisitionDate: "2026-03-01", purpose: "EGGS", status: "ACTIVE", version: 1, createdBy: actorId, createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z" };
function fixture() {
  const authorization: RegistryAuthorization = { account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })), scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })) };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Farm" })) };
  const repository: PoultryBatchRepository = { startPoultryBatch: vi.fn(async () => row), poultryBatch: vi.fn(async (): Promise<PoultryBatchView | null> => row), poultryBatches: vi.fn(async () => ({ items: [row], nextCursor: null })), animalTypes: vi.fn(async () => ({ items: [{ animalTypeId: input.animalTypeId, name: "Chicken" }], nextCursor: null })) };
  return { service: new PoultryBatchService(authorization, farms, repository), authorization, farms, repository };
}
describe("poultry batch service", () => {
  it("normalizes commands and derives scope from current authorization", async () => {
    const { service, repository, authorization } = fixture();
    await expect(service.start(farmId, input)).resolves.toEqual(row);
    expect(authorization.scope).toHaveBeenCalledWith(tenantId, ["FARMER"]);
    expect(repository.startPoultryBatch).toHaveBeenCalledWith({ actorId, tenantId, farmId }, expect.objectContaining({ batchLabel: "Batch #004", startingQuantity: 100, breed: undefined }));
  });
  it("authenticates before input, pagination and ID validation", async () => {
    const { service, authorization, farms, repository } = fixture();
    vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    for (const call of [() => service.start("bad", {}), () => service.batch("bad", "bad"), () => service.list("bad", {}), () => service.animalTypes("bad", {})]) await expect(call()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(farms.farmScopeForMember).not.toHaveBeenCalled();
    expect(repository.startPoultryBatch).not.toHaveBeenCalled(); expect(repository.animalTypes).not.toHaveBeenCalled();
  });
  it("denies missing membership, disallowed tenant role and changed identity", async () => {
    for (const reason of ["farm", "role", "identity"]) {
      const { service, authorization, farms, repository } = fixture();
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      if (reason === "identity") vi.mocked(authorization.scope).mockResolvedValue({ actorId: id(), organizationId: tenantId, role: "FARMER" });
      for (const call of [() => service.start(farmId, input), () => service.batch(farmId, row.batchId), () => service.list(farmId), () => service.animalTypes(farmId)]) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repository.startPoultryBatch).not.toHaveBeenCalled(); expect(repository.poultryBatch).not.toHaveBeenCalled(); expect(repository.poultryBatches).not.toHaveBeenCalled(); expect(repository.animalTypes).not.toHaveBeenCalled();
    }
  });
  it.each(["tenantId", "farmId", "actorId", "status", "version", "currentQuantity", "animalTypeName"])("rejects a forged %s without calling the write port", async key => {
    const { service, repository } = fixture();
    await expect(service.start(farmId, { ...input, [key]: key === "version" || key === "currentQuantity" ? 1 : id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.startPoultryBatch).not.toHaveBeenCalled();
  });
  it.each([-1, "1.5", "-0", 2.5])("rejects fractional or negative birds %j before the write port", async startingQuantity => {
    const { service, repository } = fixture();
    await expect(service.start(farmId, { ...input, startingQuantity })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.startPoultryBatch).not.toHaveBeenCalled();
  });
  it("scopes detail/list/catalog calls, default pagination and unknown nested IDs", async () => {
    const { service, repository } = fixture();
    await expect(service.batch(farmId, row.batchId)).resolves.toEqual(row);
    await service.list(farmId); await service.animalTypes(farmId, { limit: 1 });
    expect(repository.poultryBatch).toHaveBeenCalledWith({ tenantId, farmId, actorId }, row.batchId);
    expect(repository.poultryBatches).toHaveBeenCalledWith({ tenantId, farmId, actorId }, { limit: 20 });
    expect(repository.animalTypes).toHaveBeenCalledWith({ tenantId, farmId, actorId }, { limit: 1 });
    vi.mocked(repository.poultryBatch).mockResolvedValue(null);
    await expect(service.batch(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects malformed IDs and unbounded/forged pagination", async () => {
    const { service, repository } = fixture();
    await expect(service.batch(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    for (const page of [{ limit: 51 }, { limit: 0 }, { cursor: "bad" }, { tenantId }]) {
      await expect(service.list(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(service.animalTypes(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
    expect(repository.poultryBatch).not.toHaveBeenCalled(); expect(repository.poultryBatches).not.toHaveBeenCalled(); expect(repository.animalTypes).not.toHaveBeenCalled();
  });
});
