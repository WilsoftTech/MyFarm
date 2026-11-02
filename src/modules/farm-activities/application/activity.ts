import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { activityCapabilitiesSchema, activityPageSchema, cancelActivitySchema, completeActivitySchema, scheduleActivitySchema, type ActivityRecord, type ActivityRepository, type ActivityView } from "../contracts/activity";
import { activityState, farmToday } from "../domain/activity";

export class ActivityService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: ActivityRepository, private readonly now: () => Date = () => new Date()) {}
  private present(row: ActivityRecord): ActivityView { return { ...row, state: activityState(row.status, row.dueOn, farmToday(this.now())) }; }
  async schedule(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.present(await this.repo.schedule(scope, parse(scheduleActivitySchema, input)));
  }
  async complete(farmId: unknown, activityId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.present(await this.repo.complete(scope, parse(idSchema, activityId), parse(completeActivitySchema, input)));
  }
  async cancel(farmId: unknown, activityId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.present(await this.repo.cancel(scope, parse(idSchema, activityId), parse(cancelActivitySchema, input)));
  }
  async list(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const page = await this.repo.activities(scope, parse(activityPageSchema, input), farmToday(this.now()));
    return { ...page, items: page.items.map(row => this.present(row)) };
  }
  async detail(farmId: unknown, id: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const row = await this.repo.activity(scope, parse(idSchema, id));
    if (!row) throw new FoundationError("FORBIDDEN");
    return this.present(row);
  }
  async capabilities(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const rows = await this.repo.capabilities(scope, parse(activityCapabilitiesSchema, input).enterpriseId);
    if (!rows) throw new FoundationError("FORBIDDEN");
    return rows;
  }
}
