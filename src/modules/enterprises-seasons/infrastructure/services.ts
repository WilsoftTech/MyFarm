import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ProductionService } from "../application/production";
import type { ProductionRepository } from "../contracts/production";
import { productionRepository } from "./repository";

export function productionService() {
  // Anonymous requests must fail before constructing a database client.
  const repository = () => productionRepository(database());
  const lazy: ProductionRepository = {
    enterprise: (scope, id) => repository().enterprise(scope, id),
    season: (scope, id) => repository().season(scope, id),
    plot: (scope, id) => repository().plot(scope, id),
    enterprises: (scope, page) => repository().enterprises(scope, page),
    seasons: (scope, page) => repository().seasons(scope, page),
    createEnterprise: (scope, input) => repository().createEnterprise(scope, input),
    createSeason: (scope, input) => repository().createSeason(scope, input),
  };
  return new ProductionService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, lazy);
}
