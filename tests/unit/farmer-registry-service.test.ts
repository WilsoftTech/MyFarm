import { describe, expect, it, vi } from "vitest";
import { FarmerRegistryService, type RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { FarmerView, FarmView, RegistryRepository } from "@/modules/farmer-registry/contracts/registry";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

const accountId = crypto.randomUUID(), tenantId = crypto.randomUUID(), farmId = crypto.randomUUID();
const farmer: FarmerView = { farmerId: crypto.randomUUID(), tenantId, version: 1, name: "A", phone: "+256772123456", alternativePhone: null, district: "Rukungiri", subcounty: null, village: null, preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] };
const farm: FarmView = { farmId, tenantId, name: "Home", district: "Rukungiri", subcounty: null, village: null, approximateAcreage: null, ownershipType: "OWNED", primaryActivity: "CROPS", latitude: null, longitude: null, version: 1, plots: [], plotsTruncated: false };
const plot = { requestId: crypto.randomUUID(), name: "Plot A" };

function setup(options: { anonymous?: boolean; farmer?: FarmerView | null; farm?: FarmView | null; scopeDenied?: boolean } = {}) {
const authorization: RegistryAuthorization = {
account: vi.fn(async () => { if (options.anonymous) throw new FoundationError("UNAUTHENTICATED"); return { id: accountId, authSubject: crypto.randomUUID(), status: "ACTIVE" as const }; }),
scope: vi.fn(async (organizationId: unknown) => { if (options.scopeDenied) throw new FoundationError("FORBIDDEN"); return { actorId: accountId, organizationId: String(organizationId), role: "FARMER" as const }; }),
};
const repository: RegistryRepository = {
farmerForUser: vi.fn(async () => options.farmer === undefined ? farmer : options.farmer),
registerFarmer: vi.fn(async () => farmer),
updateProfile: vi.fn(async () => farmer),
farmsForMember: vi.fn(async () => ({ items: [], nextCursor: null })),
farmForMember: vi.fn(async () => options.farm === undefined ? farm : options.farm),
createFarm: vi.fn(async () => ({ farmId })),
createPlot: vi.fn(async () => ({ plotId: crypto.randomUUID() })),
};
return { service: new FarmerRegistryService(authorization, repository), authorization, repository };
}

describe("FarmerRegistryService authorization", () => {
it("authenticates before validating input", async () => {
const { service, repository } = setup({ anonymous: true });
await expect(service.register({ junk: true })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
await expect(service.createPlot("not-an-id", {})).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
expect(repository.registerFarmer).not.toHaveBeenCalled();
});
it("allows only one farmer per user", async () => {
const { service, repository } = setup();
await expect(service.register({ requestId: crypto.randomUUID(), name: "A", phone: "0772123456", district: "R", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] })).rejects.toMatchObject({ code: "CONFLICT" });
expect(repository.registerFarmer).not.toHaveBeenCalled();
});
it("treats unknown or foreign farms as forbidden without writing", async () => {
const { service, repository } = setup({ farm: null });
await expect(service.farm(farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(service.createPlot(farmId, plot)).rejects.toMatchObject({ code: "FORBIDDEN" });
expect(repository.createPlot).not.toHaveBeenCalled();
});
it("derives plot tenant from the authorized farm and rejects client scope claims", async () => {
const { service, repository, authorization } = setup();
await service.createPlot(farmId, plot);
expect(authorization.scope).toHaveBeenCalledWith(tenantId, ["FARMER"]);
expect(repository.createPlot).toHaveBeenCalledWith(expect.objectContaining({ tenantId, farmId, actorId: accountId }));
await expect(service.createPlot(farmId, { ...plot, tenantId: crypto.randomUUID() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
await expect(service.createFarm({ requestId: crypto.randomUUID(), name: "F", district: "R", ownershipType: "OWNED", primaryActivity: "CROPS", ownerFarmerId: crypto.randomUUID() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
it("revoked tenant membership denies farm and list access", async () => {
const { service } = setup({ scopeDenied: true });
await expect(service.farm(farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(service.listFarms()).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(service.currentFarmer()).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("unregistered users cannot use farm commands", async () => {
const { service, repository } = setup({ farmer: null });
expect(await service.currentFarmer()).toBeNull();
await expect(service.listFarms()).rejects.toMatchObject({ code: "FORBIDDEN" });
await expect(service.updateProfile({})).rejects.toMatchObject({ code: "FORBIDDEN" });
expect(repository.farmsForMember).not.toHaveBeenCalled();
});
it("bounds list page size", async () => {
const { service } = setup();
await expect(service.listFarms({ limit: 500 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
await expect(service.listFarms({ cursor: "../etc" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
});
});
