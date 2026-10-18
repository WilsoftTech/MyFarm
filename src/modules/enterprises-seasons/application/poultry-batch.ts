import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { startPoultryBatchSchema, type PoultryBatchRepository } from "../contracts/poultry-batch";
import { productionPageSchema } from "../contracts/production";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "./farm-access";

export class PoultryBatchService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: PoultryBatchRepository) {}
  async start(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.startPoultryBatch(scope, parse(startPoultryBatchSchema, input));
  }
  async batch(farmId: unknown, batchId: unknown) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    const row = await this.repository.poultryBatch(scope, parse(idSchema, batchId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async list(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.poultryBatches(scope, parse(productionPageSchema, input));
  }
  async animalTypes(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.animalTypes(scope, parse(productionPageSchema, input));
  }
}
