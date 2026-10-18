import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { startCropCycleSchema, type CropCycleRepository } from "../contracts/crop-cycle";
import { productionPageSchema } from "../contracts/production";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "./farm-access";

export class CropCycleService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: CropCycleRepository) {}
  async start(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.startCropCycle(scope, parse(startCropCycleSchema, input));
  }
  async cycle(farmId: unknown, cycleId: unknown) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    const row = await this.repository.cropCycle(scope, parse(idSchema, cycleId));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async list(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.cropCycles(scope, parse(productionPageSchema, input));
  }
  async crops(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.crops(scope, parse(productionPageSchema, input));
  }
}
