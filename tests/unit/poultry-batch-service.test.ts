import { describe, expect, it, vi } from "vitest";
import { PoultryBatchService } from "@/modules/enterprises-seasons/application/poultry-batch";
import type { PoultryBatchRepository, PoultryBatchView } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const id = () => crypto.randomUUID();
const actorId = id(), farmId = id(), tenantId = id();
const input = { requestId: id(), enterpriseId: id(), batchName: " Batch 1 ", animalType: "Chicken", startingQuantity: "0300", acquisitionDate: "2026-03-01", purpose: "Layers", breed: " " };
const row: PoultryBatchView = { enterpriseId: input.enterpriseId, batchName: "Batch 1", animalType: "Chicken", startingQuantity: 300, acquisitionDate: "2026-03-01", purpose: "Layers", breed: null, batchId: id(), farmId, tenantId, currentQuantity: { quantity: 300, source: "STARTING_QUANTITY" }, status: "ACTIVE", version: 1, createdBy: actorId, createdAt: "2026-10-24T00:00:00Z", updatedAt: "2026-10-24T00:00:00Z" };
function fixture() {
  const authorization: RegistryAuthorization = { account: vi.fn(async () => ({ id: actorId, authSubject: id(), status: "ACTIVE" as const })), scope: vi.fn(async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const })) };
  const farms: ProductionFarmAccess = { farmScopeForMember: vi.fn(async () => ({ farmId, tenantId, name: "Farm" })) };
  const repository: PoultryBatchRepository = { startPoultryBatch: vi.fn(async () => row), poultryBatch: vi.fn(async (): Promise<PoultryBatchView | null> => row), poultryBatches: vi.fn(async () => ({ items: [row], nextCursor: null })) };
  return { service: new PoultryBatchService(authorization, farms, repository), authorization, farms, repository };
}
describe("poultry-batch service", () => {
  it("normalizes commands and derives scope from current authorization", async () => {
    const { service, repository, authorization } = fixture();
    await expect(service.start(farmId, input)).resolves.toEqual(row);
    expect(authorization.scope).toHaveBeenCalledWith(tenantId, ["FARMER"]);
    expect(repository.startPoultryBatch).toHaveBeenCalledWith({ actorId, tenantId, farmId }, expect.objectContaining({ batchName: "Batch 1", startingQuantity: 300, breed: undefined }));
  });
  it("authenticates before input, pagination and ID validation", async () => {
    const { service, authorization, farms, repository } = fixture();
    vi.mocked(authorization.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    for (const call of [() => service.start("bad", {}), () => service.batch("bad", "bad"), () => service.list("bad", {})]) await expect(call()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(farms.farmScopeForMember).not.toHaveBeenCalled(); expect(repository.startPoultryBatch).not.toHaveBeenCalled();
  });
  it("denies missing membership, disallowed tenant role and changed identity", async () => {
    for (const reason of ["farm", "role", "identity"]) {
      const { service, authorization, farms, repository } = fixture();
      if (reason === "farm") vi.mocked(farms.farmScopeForMember).mockResolvedValue(null);
      if (reason === "role") vi.mocked(authorization.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
      if (reason === "identity") vi.mocked(authorization.scope).mockResolvedValue({ actorId: id(), organizationId: tenantId, role: "FARMER" });
      for (const call of [() => service.start(farmId, input), () => service.batch(farmId, row.batchId), () => service.list(farmId)]) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repository.startPoultryBatch).not.toHaveBeenCalled(); expect(repository.poultryBatch).not.toHaveBeenCalled(); expect(repository.poultryBatches).not.toHaveBeenCalled();
    }
  });
  it.each(["tenantId", "farmId", "actorId", "status", "version", "currentQuantity"])("rejects a forged %s without calling the write port", async key => {
    const { service, repository } = fixture();
    await expect(service.start(farmId, { ...input, [key]: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.startPoultryBatch).not.toHaveBeenCalled();
  });
  it.each(["1.5", "-1", "1e3"])("rejects bird count %s before the write port", async startingQuantity => {
    const { service, repository } = fixture();
    await expect(service.start(farmId, { ...input, startingQuantity })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.startPoultryBatch).not.toHaveBeenCalled();
  });
  it("scopes detail/list calls, default pagination and unknown nested IDs", async () => {
    const { service, repository } = fixture();
    await expect(service.batch(farmId, row.batchId)).resolves.toEqual(row);
    await service.list(farmId);
    expect(repository.poultryBatch).toHaveBeenCalledWith({ tenantId, farmId, actorId }, row.batchId);
    expect(repository.poultryBatches).toHaveBeenCalledWith({ tenantId, farmId, actorId }, { limit: 20 });
    vi.mocked(repository.poultryBatch).mockResolvedValue(null);
    await expect(service.batch(farmId, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects malformed IDs and unbounded/forged pagination", async () => {
    const { service, repository } = fixture();
    await expect(service.batch(farmId, "bad")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    for (const page of [{ limit: 51 }, { limit: 0 }, { cursor: "bad" }, { tenantId }]) await expect(service.list(farmId, page)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.poultryBatch).not.toHaveBeenCalled(); expect(repository.poultryBatches).not.toHaveBeenCalled();
  });
});
