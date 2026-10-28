import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { productionPageSchema } from "@/modules/enterprises-seasons/contracts/production";
import { createItemSchema, stockOperationSchema, reverseStockSchema, type StockRepository } from "../contracts/stock";
export class StockService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: StockRepository) {}
  async items(farmId: unknown, input: unknown = {}) { const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId); return this.repo.items(scope,parse(productionPageSchema,input)); }
  async operations(farmId: unknown, input: unknown = {}) { const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId); return this.repo.operations(scope,parse(productionPageSchema,input)); }
  async createItem(farmId: unknown, input: unknown) { const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId); return this.repo.createItem(scope,parse(createItemSchema,input)); }
  async post(farmId: unknown, input: unknown) { const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId); return this.repo.post(scope,parse(stockOperationSchema,input)); }
  async reverse(farmId: unknown, input: unknown) { const {scope}=await authorizeProductionFarm(this.auth,this.farms,farmId); return this.repo.reverse(scope,parse(reverseStockSchema,input)); }
}
