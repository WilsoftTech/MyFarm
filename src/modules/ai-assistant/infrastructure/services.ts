import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { requestLimits } from "@/modules/engineering-foundation/infrastructure/request-limits";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { farmProfitabilityService } from "@/modules/analytics-profitability/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { AssistantService, type FarmSources } from "../application/assistant";
import { sourcesFrom } from "../application/sources";
import { assistantRepository } from "./assistant-repository";
import { fakeProvider } from "./fake-provider";

/** Each read goes through the module's own authorized service, so membership is checked again for every tool. */
export function farmSources(): FarmSources {
  return sourcesFrom({ profitability: farmProfitabilityService(), accounting: farmAccountingService(), intelligence: farmIntelligenceService(), activities: activityService() });
}

export function assistantService() {
  // Anonymous requests must fail before constructing a database client, so each call builds the repository.
  return new AssistantService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) },
    farmSources(),
    {
      byRequest: (...args) => assistantRepository(database()).byRequest(...args), record: (...args) => assistantRepository(database()).record(...args),
      list: (...args) => assistantRepository(database()).list(...args), remove: (...args) => assistantRepository(database()).remove(...args),
    },
    // D-P11-002: the fake until the owner chooses a provider.
    fakeProvider,
    { take: (subject, action, requestKey) => requestLimits(database()).take(subject, action, requestKey) });
}
