import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { reportDate } from "@/modules/farm-accounting/contracts/accounting";
import { RECOGNITION_BASES } from "@/modules/farm-accounting/domain/accounting";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { BatchMetrics, CostGroup, CostGroupTotals, CropMetrics, StockItemFacts, StockValue } from "../domain/metrics";
import type { BatchTrend, CropTrend, TrendBatchFacts, TrendCycleFacts } from "../domain/trends";
import type { CurrencyDashboard, EnterpriseName, UnlinkedAmounts } from "../domain/profitability";

/** The filter value for "not one season": every record, or the chosen dates. */
export const ALL_RECORDS = "all";

/**
 * Dashboard filters: one season, or all records optionally narrowed by dates. With nothing chosen, the default
 * view applies (D-P08-008). Tenant and farm are absent because the server derives them from current membership.
 */
export const dashboardQuerySchema = z.object({
  basis: z.enum(RECOGNITION_BASES).default("ACCRUAL"),
  seasonId: z.union([z.literal(""), z.literal(ALL_RECORDS), idSchema]).optional().transform(value => value || undefined),
  from: reportDate,
  to: reportDate,
}).strict()
  .refine(value => !value.from || !value.to || value.from <= value.to, { message: "The end date must be on or after the start date.", path: ["to"] })
  .refine(value => !value.seasonId || value.seasonId === ALL_RECORDS || (!value.from && !value.to), { message: "To use dates, choose all records instead of one season.", path: ["seasonId"] });
export type DashboardQuery = z.output<typeof dashboardQuerySchema>;

export interface DashboardSeason { seasonId: string; label: string; status: "ACTIVE" | "CLOSED"; startDate: string; endDate: string | null }
export interface DashboardView {
  basis: DashboardQuery["basis"];
  /** The season shown, or null for all records, chosen dates or a farm with no active season. */
  season: DashboardSeason | null;
  from: string | null;
  to: string | null;
  /** Figures are calculated when asked for (D-P08-008), never read from a stored snapshot. */
  asOf: string;
  currencies: CurrencyDashboard[];
  /** Filled only for a season view. */
  notLinkedToSeason: UnlinkedAmounts[];
  seasons: DashboardSeason[];
}

/** The choices shown are the newest seasons up to a limit; a season past the limit still opens by its ID. */
export const MAX_DASHBOARD_SEASONS = 100;
/** Read port. Constrains tenant AND farm. */
export interface DashboardSeasons {
  seasons(scope: FarmScope): Promise<DashboardSeason[]>;
  season(scope: FarmScope, seasonId: string): Promise<DashboardSeason | null>;
}

/** R002 figures for the same view as the dashboard. Batch figures cover a batch's whole life, and stock is as of now. */
export interface MetricsView extends Pick<DashboardView, "basis" | "season" | "from" | "to" | "asOf"> {
  crops: (CropMetrics & { enterpriseName: string })[];
  batches: BatchMetrics[];
  costGroups: CostGroupTotals[];
  stock: StockValue;
}
/** Everything the formulas divide by, read fresh. Reversed harvests, losses, deaths, purchases and sales are already left out. */
export interface MetricFacts {
  /** Each carries its season, so trends can find an earlier one. */
  cycles: TrendCycleFacts[];
  enterprises: EnterpriseName[];
  /** Newest first; each carries its animal type and acquisition date, so trends can find the previous batch. */
  batches: TrendBatchFacts[];
  items: StockItemFacts[];
  costGroups: { categoryId: string; group: CostGroup }[];
}
/** Limits on what one screen reads; a farm is not expected to reach them. */
export const MAX_METRIC_BATCHES = 100, MAX_METRIC_ITEMS = 200;
/** Read port. Constrains tenant AND farm. Cycles are of one season, or of every season when none is given. */
export interface MetricFactsRepository { facts(scope: FarmScope, seasonId: string | null): Promise<MetricFacts> }

/**
 * R003 trends for the same filters (D-P08-007). Crops compare one season with an earlier one, so they need a season
 * view; batches compare whole lives, whichever season or dates are shown. Figures are calculated when asked for.
 */
export interface TrendsView extends Pick<DashboardView, "basis" | "season" | "from" | "to" | "asOf"> {
  /** True when no season is shown, so crop trends are left out until one is chosen. */
  cropsNeedSeason: boolean;
  crops: CropTrend[];
  batches: BatchTrend[];
}
