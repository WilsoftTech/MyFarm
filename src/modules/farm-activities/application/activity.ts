import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { productionPageSchema } from "@/modules/enterprises-seasons/contracts/production";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { activityCapabilitiesSchema, scheduleActivitySchema, type ActivityRepository } from "../contracts/activity";

export class ActivityService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: ActivityRepository) {}
  async schedule(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.schedule(scope, parse(scheduleActivitySchema, input));
  }
  async list(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.activities(scope, parse(productionPageSchema, input));
  }
  async detail(farmId: unknown, id: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const row = await this.repo.activity(scope, parse(idSchema, id));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
  async capabilities(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const rows = await this.repo.capabilities(scope, parse(activityCapabilitiesSchema, input).enterpriseId);
    if (!rows) throw new FoundationError("FORBIDDEN");
    return rows;
  }
}
