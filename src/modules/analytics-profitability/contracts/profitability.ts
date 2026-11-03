import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { reportDate } from "@/modules/farm-accounting/contracts/accounting";
import { RECOGNITION_BASES } from "@/modules/farm-accounting/domain/accounting";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { CurrencyDashboard, UnlinkedAmounts } from "../domain/profitability";

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
