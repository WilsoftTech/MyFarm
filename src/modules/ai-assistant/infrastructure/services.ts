import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { requestLimits } from "@/modules/engineering-foundation/infrastructure/request-limits";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { farmProfitabilityService } from "@/modules/analytics-profitability/infrastructure/services";
import { AssistantService } from "../application/assistant";
import { assistantRepository } from "./assistant-repository";
import { fakeProvider } from "./fake-provider";

export function assistantService() {
  // Anonymous requests must fail before constructing a database client, so each call builds the repository.
  return new AssistantService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) },
    { dashboard: (farmId, input) => farmProfitabilityService().dashboard(farmId, input) },
    {
      byRequest: (...args) => assistantRepository(database()).byRequest(...args), record: (...args) => assistantRepository(database()).record(...args),
      list: (...args) => assistantRepository(database()).list(...args), remove: (...args) => assistantRepository(database()).remove(...args),
    },
    // D-P11-002: the fake until the owner chooses a provider.
    fakeProvider,
    { take: (subject, action, requestKey) => requestLimits(database()).take(subject, action, requestKey) });
}
