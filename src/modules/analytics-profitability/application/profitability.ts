import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import type { FarmReportRepository } from "@/modules/farm-accounting/contracts/accounting";
import { recognizedEvents, type RecognitionEvent } from "@/modules/farm-accounting/domain/accounting";
import { eventsInScope } from "@/modules/farm-accounting/domain/reporting";
import { ALL_RECORDS, dashboardQuerySchema, type DashboardSeasons, type DashboardView, type MetricFacts, type MetricFactsRepository, type FarmScreen, type MetricsView, type TrendsView } from "../contracts/profitability";
import { batchMetrics, costGroupTotals, cropMetrics, stockValue, type CostGroup } from "../domain/metrics";
import { farmDashboard, latestActiveSeason, seasonEvents, type EnterpriseName } from "../domain/profitability";
import { reconcile } from "../domain/reconcile";
import { batchTrends, cropTrends } from "../domain/trends";

type View = Awaited<ReturnType<FarmProfitabilityService["view"]>>;

/** R001 to R004: authorize the farm first; figures are calculated from source records on every request (D-P08-008). */
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

  /** Every record in the view's basis. Each figure narrows them itself: batches cover whole lives, trends pick their own sides. */
  private async events(view: View): Promise<{ whole: RecognitionEvent[]; enterprises: EnterpriseName[] }> {
    const sources = await this.reports.reportSources(view.scope, { basis: view.query.basis, from: undefined, to: undefined });
    return { whole: recognizedEvents(view.query.basis, sources.records, sources.payments), enterprises: sources.enterprises };
  }
  /** The view's own events: chosen dates first, then only records linked to the chosen season (D-P08-008). */
  private shown({ query, season }: View, whole: readonly RecognitionEvent[]) {
    const dated = Boolean(query.from || query.to);
    const inRange = dated ? eventsInScope(whole, { basis: query.basis, from: query.from, to: query.to }) : [...whole];
    return { dated, ...(season ? seasonEvents(inRange, season.seasonId) : { events: inRange, notLinkedToSeason: [] }) };
  }
  private labels({ query, season }: View) {
    return { basis: query.basis, season, from: query.from ?? null, to: query.to ?? null, asOf: this.now().toISOString() };
  }

  private dashboardOf(view: View, whole: readonly RecognitionEvent[], enterprises: readonly EnterpriseName[]): DashboardView {
    const shown = this.shown(view, whole);
    return { ...this.labels(view), seasons: view.seasons, currencies: farmDashboard(shown.events, enterprises), notLinkedToSeason: shown.notLinkedToSeason };
  }
  private metricsOf(view: View, whole: readonly RecognitionEvent[], facts: MetricFacts): MetricsView {
    const { events, dated } = this.shown(view, whole), season = view.season;
    const names = new Map(facts.enterprises.map(row => [row.enterpriseId, row.name]));
    const cycles = season ? facts.cycles.filter(row => row.seasonId === season.seasonId) : facts.cycles;
    return {
      ...this.labels(view),
      crops: cropMetrics(cycles, events, season ? "SEASON" : dated ? "DATE_RANGE" : "ALL_RECORDS").map(line => ({ ...line, enterpriseName: names.get(line.enterpriseId) ?? "" })),
      batches: batchMetrics(facts.batches, whole),
      costGroups: costGroupTotals(events, new Map<string, CostGroup>(facts.costGroups.map(row => [row.categoryId, row.group]))),
      stock: stockValue(facts.items),
    };
  }
  /** R003: how figures moved against the same crop's earlier season or the same animal's previous batch (D-P08-007). */
  private trendsOf(view: View, whole: readonly RecognitionEvent[], facts: MetricFacts): TrendsView {
    const season = view.season;
    return {
      ...this.labels(view), cropsNeedSeason: !season,
      // Every season of the farm, so an earlier one is found however many there are (P8-C4).
      crops: season ? cropTrends(facts.cycles, whole, facts.seasons, season.seasonId) : [],
      batches: batchTrends(facts.batches, whole, facts.earlierBatches),
    };
  }

  async dashboard(farmId: unknown, input: unknown = {}): Promise<DashboardView> {
    const view = await this.view(farmId, input);
    const { whole, enterprises } = await this.events(view);
    return this.dashboardOf(view, whole, enterprises);
  }
  async metrics(farmId: unknown, input: unknown = {}): Promise<MetricsView> {
    const view = await this.view(farmId, input);
    const [{ whole }, facts] = await Promise.all([this.events(view), this.facts.facts(view.scope, view.season?.seasonId ?? null)]);
    return this.metricsOf(view, whole, facts);
  }
  async trends(farmId: unknown, input: unknown = {}): Promise<TrendsView> {
    const view = await this.view(farmId, input);
    const [{ whole }, facts] = await Promise.all([this.events(view), this.facts.facts(view.scope, null)]);
    return this.trendsOf(view, whole, facts);
  }

  /**
   * R004: everything "How the farm is doing" shows, for one view, with the check that it adds up (L gate). It
   * authorizes once and reads the farm's records and facts once, then derives every part from them (P8-C4).
   */
  async farmScreen(farmId: unknown, input: unknown = {}): Promise<FarmScreen> {
    const view = await this.view(farmId, input);
    const [{ whole, enterprises }, facts] = await Promise.all([this.events(view), this.facts.facts(view.scope, null)]);
    const dashboard = this.dashboardOf(view, whole, enterprises), metrics = this.metricsOf(view, whole, facts);
    return { dashboard, metrics, trends: this.trendsOf(view, whole, facts), reconciliation: reconcile(dashboard.currencies, metrics.costGroups, metrics.crops) };
  }
}
