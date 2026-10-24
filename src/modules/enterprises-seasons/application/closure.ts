import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { closeProductionSchema, closureKindSchema, type ClosureRepository } from "../contracts/closure";
import { authorizeProductionFarm, parseProductionInput, type ProductionFarmAccess } from "./farm-access";

export class ProductionClosureService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repository: ClosureRepository) {}
  async close(farmId: unknown, kind: unknown, recordId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    return this.repository.close(scope, parseProductionInput(closureKindSchema, kind), parseProductionInput(idSchema, recordId), parseProductionInput(closeProductionSchema, input));
  }
}
