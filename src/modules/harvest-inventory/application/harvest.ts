import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { productionPageSchema } from "@/modules/enterprises-seasons/contracts/production";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { createStorageLocationSchema, recordHarvestSchema, type HarvestRepository } from "../contracts/harvest";

export class HarvestService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: HarvestRepository) {}
  async record(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.recordHarvest(scope, parse(recordHarvestSchema, input));
  }
  async list(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.harvests(scope, parse(productionPageSchema, input));
  }
  async detail(farmId: unknown, id: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const row = await this.repo.harvest(scope, parse(idSchema, id));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async locations(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.locations(scope, parse(productionPageSchema, input));
  }
  async createLocation(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.createLocation(scope, parse(createStorageLocationSchema, input));
  }
}
