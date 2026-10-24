import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ProductionService } from "../application/production";
import type { ProductionRepository } from "../contracts/production";
import { productionRepository } from "./repository";
import { CropCycleService } from "../application/crop-cycle";
import type { CropCycleRepository } from "../contracts/crop-cycle";
import { cropCycleRepository } from "./crop-cycle-repository";

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

export function cropCycleService() {
  const repository = () => cropCycleRepository(database());
  const lazy: CropCycleRepository = {
    plots: (scope, page) => repository().plots(scope, page),
    plot: (scope, id) => repository().plot(scope, id),
    crops: (scope, page) => repository().crops(scope, page),
    cropCycle: (scope, id) => repository().cropCycle(scope, id),
    cropCycles: (scope, page) => repository().cropCycles(scope, page),
    startCropCycle: (scope, command) => repository().startCropCycle(scope, command),
  };
  return new CropCycleService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, lazy);
}
