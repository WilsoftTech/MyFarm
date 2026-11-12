import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { RequestLimitPort } from "@/modules/engineering-foundation/contracts/request-limits";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { acknowledgeInsightSchema, setFeedItemSchema, type InsightRepository } from "../contracts/insights";

/** Evaluations are counted per person (D-P10-009), on the database clock. */
export type EvaluationLimits = Pick<RequestLimitPort, "take">;
const UNLIMITED: EvaluationLimits = { take: async () => true };

/**
 * GenerateInsight, CheckDataReadiness and AcknowledgeInsight (MYF-P10-R001). The farm is authorized first; the rules
 * then run on the server against the farm's own records, on the farm's date (Africa/Kampala, D-P06-002). No LLM.
 */
export class FarmIntelligenceService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly repo: InsightRepository, private readonly now: () => Date = () => new Date(), private readonly limits: EvaluationLimits = UNLIMITED) {}
  /** Each call evaluates and stores, so it counts against INSIGHTS_EVALUATE once the farm is authorized (P10-C4). */
  async feed(farmId: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    if (!(await this.limits.take(scope.actorId, "INSIGHTS_EVALUATE", null))) throw new FoundationError("RATE_LIMITED");
    return this.repo.generate(scope, farmToday(this.now()));
  }
  async acknowledge(farmId: unknown, insightId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.acknowledge(scope, parse(idSchema, insightId), parse(acknowledgeInsightSchema, input));
  }
  async feedItem(farmId: unknown, batchId: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.feedItem(scope, parse(idSchema, batchId));
  }
  /** D-P10-007: which supply item a batch is fed from, for the shortage rule. */
  async setFeedItem(farmId: unknown, batchId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.setFeedItem(scope, parse(idSchema, batchId), parse(setFeedItemSchema, input));
  }
}
