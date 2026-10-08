import type { Account, AuthorizedScope, Role } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { createFarmSchema, createPlotSchema, farmIdSchema, farmPageSchema, registerFarmerSchema, updateProfileSchema, type FarmerView, type RegistryRepository } from "../contracts/registry";

// Current-request authorization from Phase1: verified session, active account, active organization membership.
export interface RegistryAuthorization {
account(): Promise<Account>;
scope(organizationId: unknown, roles?: readonly Role[]): Promise<AuthorizedScope>;
}
const FARMER_ROLES = ["FARMER"] as const;

function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, input: unknown): T {
const result = schema.safeParse(input);
if (!result.success) throw new FoundationError("INVALID_INPUT");
return result.data;
}

// Every method authenticates before validating input, so anonymous callers learn nothing from validation.
export class FarmerRegistryService {
constructor(private readonly authorization: RegistryAuthorization, private readonly repository: RegistryRepository) {}

/** Null means the signed-in account has not registered as a farmer yet. */
async currentFarmer(): Promise<FarmerView | null> {
const account = await this.authorization.account();
const farmer = await this.repository.farmerForUser(account.id);
if (!farmer) return null;
await this.authorization.scope(farmer.tenantId, FARMER_ROLES);
return farmer;
}

async register(input: unknown) {
const account = await this.authorization.account();
const { requestId, ...profile } = parse(registerFarmerSchema, input);
// Q05: one farmer per user. Repository uniqueness enforces this under concurrency too.
if (await this.repository.farmerForUser(account.id)) throw new FoundationError("CONFLICT");
return this.repository.registerFarmer({ userId: account.id, requestId, profile });
}

async updateProfile(input: unknown) {
const { account, farmer } = await this.ownFarmer();
const { requestId, expectedVersion, ...profile } = parse(updateProfileSchema, input);
return this.repository.updateProfile({ farmerId: farmer.farmerId, tenantId: farmer.tenantId, actorId: account.id, requestId, expectedVersion, profile });
}

async listFarms(input: unknown = {}) {
const { account, farmer } = await this.ownFarmer();
const page = parse(farmPageSchema, input);
return this.repository.farmsForMember({ userId: account.id, tenantId: farmer.tenantId, ...page });
}

async createFarm(input: unknown) {
const { account, farmer } = await this.ownFarmer();
const { requestId, ...farm } = parse(createFarmSchema, input);
return this.repository.createFarm({ tenantId: farmer.tenantId, farmerId: farmer.farmerId, actorId: account.id, requestId, farm });
}

async farm(farmId: unknown) {
return (await this.farmAccess(farmId)).farm;
}

async createPlot(farmId: unknown, input: unknown) {
const { account, farm } = await this.farmAccess(farmId);
const { requestId, ...plot } = parse(createPlotSchema, input);
// Tenant and farm come from the authorized farm record, never from the client payload.
return this.repository.createPlot({ tenantId: farm.tenantId, farmId: farm.farmId, actorId: account.id, requestId, plot });
}

private async ownFarmer() {
const account = await this.authorization.account();
const farmer = await this.repository.farmerForUser(account.id);
if (!farmer) throw new FoundationError("FORBIDDEN");
await this.authorization.scope(farmer.tenantId, FARMER_ROLES);
return { account, farmer };
}

/** FarmAccessPolicy: active farm membership AND active membership of the farm's tenant. Admin roles grant nothing here. */
private async farmAccess(farmId: unknown) {
const account = await this.authorization.account();
const id = parse(farmIdSchema, farmId);
const farm = await this.repository.farmForMember({ userId: account.id, farmId: id });
// Unknown and foreign farms are indistinguishable to the caller.
if (!farm) throw new FoundationError("FORBIDDEN");
await this.authorization.scope(farm.tenantId, FARMER_ROLES);
return { account, farm };
}
}
