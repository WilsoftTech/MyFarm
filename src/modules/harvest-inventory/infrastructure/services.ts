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

import { PoultryProductionService } from "../application/production";
import { poultryProductionRepository } from "./production-repository";
export function poultryProductionService() {
 return new PoultryProductionService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
  events: (...args) => poultryProductionRepository(database()).events(...args),event: (...args) => poultryProductionRepository(database()).event(...args),record: (...args) => poultryProductionRepository(database()).record(...args), summary: (...args) => poultryProductionRepository(database()).summary(...args),
 });
}

import { StockService } from "../application/stock";
import { stockRepository } from "./stock-repository";
export function stockService() {
 return new StockService(authorizationService(), { farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input) }, {
  operation:(...args)=>stockRepository(database()).operation(...args),operations:(...args)=>stockRepository(database()).operations(...args),items:(...args)=>stockRepository(database()).items(...args),createItem:(...args)=>stockRepository(database()).createItem(...args),post:(...args)=>stockRepository(database()).post(...args),reverse:(...args)=>stockRepository(database()).reverse(...args),
 });
}

import { ReconstructionService } from "../application/reconstruction";
import { reconstructionRepository } from "./reconstruction-repository";
export function reconstructionService() {
 return new ReconstructionService(authorizationService(), { farmScopeForMember:input=>registryRepository(database()).farmScopeForMember(input) }, {
  reconstruct:(...args)=>reconstructionRepository(database()).reconstruct(...args),history:(...args)=>reconstructionRepository(database()).history(...args),
 });
}
