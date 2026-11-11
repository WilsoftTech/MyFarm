import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmIntelligenceService } from "../application/insights";
import { insightRepository } from "./insight-repository";

export function farmIntelligenceService() {
  // Anonymous requests must fail before constructing a database client.
  return new FarmIntelligenceService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    generate: (...args) => insightRepository(database()).generate(...args), acknowledge: (...args) => insightRepository(database()).acknowledge(...args),
    setFeedItem: (...args) => insightRepository(database()).setFeedItem(...args),
  });
}
