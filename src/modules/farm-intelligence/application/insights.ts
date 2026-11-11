import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { acknowledgeInsightSchema, setFeedItemSchema, type InsightRepository } from "../contracts/insights";

/**
 * GenerateInsight, CheckDataReadiness and AcknowledgeInsight (MYF-P10-R001). The farm is authorized first; the rules
 * then run on the server against the farm's own records, on the farm's date (Africa/Kampala, D-P06-002). No LLM.
 */
export class FarmIntelligenceService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: InsightRepository, private readonly now: () => Date = () => new Date()) {}
  async feed(farmId: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.generate(scope, farmToday(this.now()));
  }
  async acknowledge(farmId: unknown, insightId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.acknowledge(scope, parse(idSchema, insightId), parse(acknowledgeInsightSchema, input));
  }
  /** D-P10-007: which supply item a batch is fed from, for the shortage rule. */
  async setFeedItem(farmId: unknown, batchId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.setFeedItem(scope, parse(idSchema, batchId), parse(setFeedItemSchema, input));
  }
}
