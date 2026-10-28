import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { HarvestService } from "../application/harvest";
import { harvestRepository } from "./harvest-repository";

export function harvestService() {
  return new HarvestService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
    locations: (...args) => harvestRepository(database()).locations(...args), createLocation: (...args) => harvestRepository(database()).createLocation(...args),
    harvest: (...args) => harvestRepository(database()).harvest(...args), harvests: (...args) => harvestRepository(database()).harvests(...args),
    recordHarvest: (...args) => harvestRepository(database()).recordHarvest(...args),
  });
}
