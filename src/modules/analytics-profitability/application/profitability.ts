import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import type { FarmReportRepository } from "@/modules/farm-accounting/contracts/accounting";
import { recognizedEvents } from "@/modules/farm-accounting/domain/accounting";
import { eventsInScope } from "@/modules/farm-accounting/domain/reporting";
import { ALL_RECORDS, dashboardQuerySchema, type DashboardSeasons, type DashboardView } from "../contracts/profitability";
import { farmDashboard, latestActiveSeason, seasonEvents } from "../domain/profitability";

/** R001 dashboard: authorize the farm first; figures are calculated from source records on every request (D-P08-008). */
export class FarmProfitabilityService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly reports: Pick<FarmReportRepository, "reportSources">, private readonly seasons: DashboardSeasons, private readonly now: () => Date = () => new Date()) {}

  async dashboard(farmId: unknown, input: unknown = {}): Promise<DashboardView> {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    const query = parse(dashboardQuerySchema, input);
    const seasons = await this.seasons.seasons(scope);
    const chosen = query.seasonId && query.seasonId !== ALL_RECORDS ? query.seasonId : null;
    const season = chosen ? seasons.find(row => row.seasonId === chosen) ?? await this.seasons.season(scope, chosen)
      : query.seasonId || query.from || query.to ? null : latestActiveSeason(seasons);
    // A season of another farm looks the same as one that does not exist.
    if (chosen && !season) throw new FoundationError("FORBIDDEN");
    const range = { basis: query.basis, from: query.from, to: query.to };
    const sources = await this.reports.reportSources(scope, range);
    const events = eventsInScope(recognizedEvents(query.basis, sources.records, sources.payments), range);
    const shown = season ? seasonEvents(events, season.seasonId) : { events, notLinkedToSeason: [] };
    return {
      basis: query.basis, season, from: query.from ?? null, to: query.to ?? null, asOf: this.now().toISOString(), seasons,
      currencies: farmDashboard(shown.events, sources.enterprises), notLinkedToSeason: shown.notLinkedToSeason,
    };
  }
}
