import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { productionEventSchema } from "../contracts/production";
import type { PoultryProductionRepository } from "../contracts/production";
export class PoultryProductionService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: PoultryProductionRepository) {}
  async event(farmId: unknown, id: unknown) {const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId);const row=await this.repo.event(scope,parse(idSchema,id));if(!row)throw new FoundationError("FORBIDDEN");return row;}
  async record(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.record(scope, parse(productionEventSchema, input));
  }
  async summary(farmId: unknown, batchId: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.summary(scope, parse(idSchema, batchId));
  }
}
