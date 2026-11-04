import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { farmReportRepository } from "@/modules/farm-accounting/infrastructure/report-repository";
import { FarmProfitabilityService } from "../application/profitability";
import { metricFactsRepository } from "./metric-facts-repository";
import { dashboardSeasonRepository } from "./repository";

export function farmProfitabilityService() {
  // Anonymous requests must fail before constructing a database client.
  return new FarmProfitabilityService(authorizationService(), {
    farmScopeForMember: input => registryRepository(database()).farmScopeForMember(input),
  }, {
    reportSources: (scope, query) => farmReportRepository(database()).reportSources(scope, query),
  }, {
    seasons: scope => dashboardSeasonRepository(database()).seasons(scope),
    season: (scope, seasonId) => dashboardSeasonRepository(database()).season(scope, seasonId),
  }, {
    facts: (scope, seasonId) => metricFactsRepository(database()).facts(scope, seasonId),
  });
}
