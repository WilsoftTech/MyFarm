import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { createEnterpriseSchema, createSeasonSchema, productionPageSchema, type ProductionRepository } from "../contracts/production";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "./farm-access";
export type { ProductionFarmAccess } from "./farm-access";

export class ProductionService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: ProductionRepository) {}

  private async farmAccess(farmId: unknown) {
    return authorizeProductionFarm(this.authorization, this.farms, farmId);
  }

  async farmContext(farmId: unknown) { return (await this.farmAccess(farmId)).farm; }

  async listEnterprises(farmId: unknown, input: unknown = {}) {
    const { scope } = await this.farmAccess(farmId);
    return this.repository.enterprises(scope, parse(productionPageSchema, input));
  }
  async listSeasons(farmId: unknown, input: unknown = {}) {
    const { scope } = await this.farmAccess(farmId);
    return this.repository.seasons(scope, parse(productionPageSchema, input));
  }
  async enterprise(farmId: unknown, enterpriseId: unknown) {
    const { scope } = await this.farmAccess(farmId);
    const row = await this.repository.enterprise(scope, parse(idSchema, enterpriseId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async season(farmId: unknown, seasonId: unknown) {
    const { scope } = await this.farmAccess(farmId);
    const row = await this.repository.season(scope, parse(idSchema, seasonId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async createEnterprise(farmId: unknown, input: unknown) {
    const { scope } = await this.farmAccess(farmId);
    return this.repository.createEnterprise(scope, parse(createEnterpriseSchema, input));
  }
  async createSeason(farmId: unknown, input: unknown) {
    const { scope } = await this.farmAccess(farmId);
    return this.repository.createSeason(scope, parse(createSeasonSchema, input));
  }
}
