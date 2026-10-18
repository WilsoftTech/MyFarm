import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { createEnterpriseSchema, createSeasonSchema, productionPageSchema, type ProductionRepository } from "../contracts/production";
import type { FarmScope } from "../domain/production";

// The existing registry repository implements this port; no second farm access policy is introduced.
export interface ProductionFarmAccess {
  farmScopeForMember(input: { userId: string; farmId: string }): Promise<FarmScope | null>;
}
function parse<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new FoundationError("INVALID_INPUT");
  return result.data;
}

export class ProductionService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: ProductionRepository) {}

  private async farmAccess(farmId: unknown) {
    const account = await this.authorization.account();
    const id = parse(idSchema, farmId);
    const farm = await this.farms.farmScopeForMember({ userId: account.id, farmId: id });
    if (!farm) throw new FoundationError("FORBIDDEN");
    const scope = await this.authorization.scope(farm.tenantId, ["FARMER"]);
    if (scope.actorId !== account.id) throw new FoundationError("FORBIDDEN");
    return { tenantId: farm.tenantId, farmId: farm.farmId, actorId: scope.actorId };
  }

  async listEnterprises(farmId: unknown, input: unknown = {}) {
    const scope = await this.farmAccess(farmId);
    return this.repository.enterprises(scope, parse(productionPageSchema, input));
  }
  async listSeasons(farmId: unknown, input: unknown = {}) {
    const scope = await this.farmAccess(farmId);
    return this.repository.seasons(scope, parse(productionPageSchema, input));
  }
  async enterprise(farmId: unknown, enterpriseId: unknown) {
    const scope = await this.farmAccess(farmId);
    const row = await this.repository.enterprise(scope, parse(idSchema, enterpriseId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async season(farmId: unknown, seasonId: unknown) {
    const scope = await this.farmAccess(farmId);
    const row = await this.repository.season(scope, parse(idSchema, seasonId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async createEnterprise(farmId: unknown, input: unknown) {
    const scope = await this.farmAccess(farmId);
    return this.repository.createEnterprise(scope, parse(createEnterpriseSchema, input));
  }
  async createSeason(farmId: unknown, input: unknown) {
    const scope = await this.farmAccess(farmId);
    return this.repository.createSeason(scope, parse(createSeasonSchema, input));
  }
}
