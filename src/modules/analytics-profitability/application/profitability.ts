import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import type { FarmReportRepository } from "@/modules/farm-accounting/contracts/accounting";
import { recognizedEvents } from "@/modules/farm-accounting/domain/accounting";
import { eventsInScope } from "@/modules/farm-accounting/domain/reporting";
import { ALL_RECORDS, dashboardQuerySchema, type DashboardSeasons, type DashboardView, type MetricFactsRepository, type MetricsView } from "../contracts/profitability";
import { batchMetrics, costGroupTotals, cropMetrics, stockValue, type CostGroup } from "../domain/metrics";
import { farmDashboard, latestActiveSeason, seasonEvents } from "../domain/profitability";

/** R001 and R002: authorize the farm first; figures are calculated from source records on every request (D-P08-008). */
export class FarmProfitabilityService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly reports: Pick<FarmReportRepository, "reportSources">, private readonly seasons: DashboardSeasons, private readonly facts: MetricFactsRepository, private readonly now: () => Date = () => new Date()) {}

  /** One season, or none for all records or chosen dates; a season of another farm looks the same as one that does not exist. */
  private async view(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.authorization, this.farms, farmId);
    const query = parse(dashboardQuerySchema, input);
    const seasons = await this.seasons.seasons(scope);
    const chosen = query.seasonId && query.seasonId !== ALL_RECORDS ? query.seasonId : null;
    const season = chosen ? seasons.find(row => row.seasonId === chosen) ?? await this.seasons.season(scope, chosen)
      : query.seasonId || query.from || query.to ? null : latestActiveSeason(seasons);
    if (chosen && !season) throw new FoundationError("FORBIDDEN");
    return { scope, query, seasons, season };
  }

  async dashboard(farmId: unknown, input: unknown = {}): Promise<DashboardView> {
    const { scope, query, seasons, season } = await this.view(farmId, input);
    const range = { basis: query.basis, from: query.from, to: query.to };
    const sources = await this.reports.reportSources(scope, range);
    const events = eventsInScope(recognizedEvents(query.basis, sources.records, sources.payments), range);
    const shown = season ? seasonEvents(events, season.seasonId) : { events, notLinkedToSeason: [] };
    return {
      basis: query.basis, season, from: query.from ?? null, to: query.to ?? null, asOf: this.now().toISOString(), seasons,
      currencies: farmDashboard(shown.events, sources.enterprises), notLinkedToSeason: shown.notLinkedToSeason,
    };
  }

  async metrics(farmId: unknown, input: unknown = {}): Promise<MetricsView> {
    const { scope, query, season } = await this.view(farmId, input);
    const range = { basis: query.basis, from: query.from, to: query.to }, dated = Boolean(query.from || query.to);
    // Every record in the view's basis: a batch's figures cover its whole life, whichever season or dates are shown.
    const sources = await this.reports.reportSources(scope, { basis: query.basis, from: undefined, to: undefined });
    const whole = recognizedEvents(query.basis, sources.records, sources.payments);
    const inRange = dated ? eventsInScope(whole, range) : whole;
    const events = season ? seasonEvents(inRange, season.seasonId).events : inRange;
    const facts = await this.facts.facts(scope, season?.seasonId ?? null);
    const names = new Map(facts.enterprises.map(row => [row.enterpriseId, row.name]));
    return {
      basis: query.basis, season, from: query.from ?? null, to: query.to ?? null, asOf: this.now().toISOString(),
      crops: cropMetrics(facts.cycles, events, season ? "SEASON" : dated ? "DATE_RANGE" : "ALL_RECORDS").map(line => ({ ...line, enterpriseName: names.get(line.enterpriseId) ?? "" })),
      batches: batchMetrics(facts.batches, whole),
      costGroups: costGroupTotals(events, new Map<string, CostGroup>(facts.costGroups.map(row => [row.categoryId, row.group]))),
      stock: stockValue(facts.items),
    };
  }
}
