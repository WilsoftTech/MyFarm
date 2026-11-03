import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { reportDate } from "@/modules/farm-accounting/contracts/accounting";
import { RECOGNITION_BASES } from "@/modules/farm-accounting/domain/accounting";
import type { CurrencyDashboard, UnlinkedAmounts } from "../domain/profitability";

/**
 * Dashboard filters: one season or a date range, never both. No season and no dates means the default view
 * (D-P08-008). Tenant and farm are absent because the server derives them from current membership.
 */
export const dashboardQuerySchema = z.object({
  basis: z.enum(RECOGNITION_BASES).default("ACCRUAL"),
  seasonId: z.union([z.literal(""), idSchema]).optional().transform(value => value || undefined),
  from: reportDate,
  to: reportDate,
}).strict()
  .refine(value => !value.from || !value.to || value.from <= value.to, { message: "The end date must be on or after the start date.", path: ["to"] })
  .refine(value => !value.seasonId || (!value.from && !value.to), { message: "Choose a season or dates, not both.", path: ["seasonId"] });
export type DashboardQuery = z.output<typeof dashboardQuerySchema>;

export interface DashboardSeason { seasonId: string; label: string; status: "ACTIVE" | "CLOSED"; startDate: string; endDate: string | null }
export interface DashboardView {
  basis: DashboardQuery["basis"];
  /** The season shown, or null for a date range or a farm with no active season. */
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
