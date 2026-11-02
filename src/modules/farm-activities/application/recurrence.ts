import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { productionPageSchema } from "@/modules/enterprises-seasons/contracts/production";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { changeRecurrenceSchema, createRecurrenceSchema, stopRecurrenceSchema, type RecurrenceRepository } from "../contracts/recurrence";
import { farmToday } from "../domain/activity";

export class RecurrenceService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: RecurrenceRepository, private readonly now: () => Date = () => new Date()) {}
  async create(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.create(scope, parse(createRecurrenceSchema, input), farmToday(this.now()));
  }
  async change(farmId: unknown, id: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.change(scope, parse(idSchema, id), parse(changeRecurrenceSchema, input), farmToday(this.now()));
  }
  async stop(farmId: unknown, id: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.stop(scope, parse(idSchema, id), parse(stopRecurrenceSchema, input), farmToday(this.now()));
  }
  /** Idempotent. Generates what is due for this farm's series up to the 30-day horizon. */
  async expand(farmId: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.expand(scope, farmToday(this.now()));
  }
  async list(farmId: unknown, input: unknown = {}) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.recurrences(scope, parse(productionPageSchema, input));
  }
  async detail(farmId: unknown, id: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const row = await this.repo.recurrence(scope, parse(idSchema, id));
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  }
}
