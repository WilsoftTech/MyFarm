import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { productionPageSchema } from "@/modules/enterprises-seasons/contracts/production";
import type { ReconstructionRepository } from "../contracts/reconstruction";
export class ReconstructionService {
 constructor(private readonly auth:RegistryAuthorization,private readonly farms:ProductionFarmAccess,private readonly repo:ReconstructionRepository){}
 async reconstruct(farmId:unknown,itemId:unknown,input:unknown={}) {const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId);return this.repo.reconstruct(scope,parse(idSchema,itemId),parse(productionPageSchema,input));}
 async history(farmId:unknown,itemId:unknown,input:unknown={}) {const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId);return this.repo.history(scope,parse(idSchema,itemId),parse(productionPageSchema,input));}
}
