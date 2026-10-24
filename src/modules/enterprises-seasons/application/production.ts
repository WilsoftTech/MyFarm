import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { createEnterpriseSchema, createSeasonSchema, productionPageSchema, type EnterpriseView, type ProductionRepository } from "../contracts/production";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "./farm-access";
import type { EnterpriseCapability } from "../contracts/catalog";
import { enterpriseWorkflow } from "../domain/production";
export type { ProductionFarmAccess } from "./farm-access";

// Enrich only authorized results; capability is derived from the domain registry, never client input.
const withCapability = (row: EnterpriseView): EnterpriseView & EnterpriseCapability => ({
  ...row, workflow: enterpriseWorkflow(row.type),
});

export class ProductionService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: ProductionRepository) {}

  private async farmAccess(farmId: unknown) {
    return authorizeProductionFarm(this.authorization, this.farms, farmId);
  }

  async farmContext(farmId: unknown) { return (await this.farmAccess(farmId)).farm; }

  async listEnterprises(farmId: unknown, input: unknown = {}) {
    const { scope } = await this.farmAccess(farmId);
    const page = await this.repository.enterprises(scope, parse(productionPageSchema, input));
    return { ...page, items: page.items.map(withCapability) };
  }
  async listSeasons(farmId: unknown, input: unknown = {}) {
    const { scope } = await this.farmAccess(farmId);
    return this.repository.seasons(scope, parse(productionPageSchema, input));
  }
  async enterprise(farmId: unknown, enterpriseId: unknown) {
    const { scope } = await this.farmAccess(farmId);
    const row = await this.repository.enterprise(scope, parse(idSchema, enterpriseId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return withCapability(row);
  }
  async season(farmId: unknown, seasonId: unknown) {
    const { scope } = await this.farmAccess(farmId);
    const row = await this.repository.season(scope, parse(idSchema, seasonId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async createEnterprise(farmId: unknown, input: unknown) {
    const { scope } = await this.farmAccess(farmId);
    return withCapability(await this.repository.createEnterprise(scope, parse(createEnterpriseSchema, input)));
  }
  async createSeason(farmId: unknown, input: unknown) {
    const { scope } = await this.farmAccess(farmId);
    return this.repository.createSeason(scope, parse(createSeasonSchema, input));
  }
}
