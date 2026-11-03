import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { MAX_DASHBOARD_SEASONS, type DashboardSeason, type DashboardSeasons } from "../contracts/profitability";

const seasonSelect = { id: true, label: true, status: true, startDate: true, endDate: true } satisfies Prisma.SeasonSelect;
type SeasonRow = Prisma.SeasonGetPayload<{ select: typeof seasonSelect }>;
const day = (value: Date) => value.toISOString().slice(0, 10);
const view = (row: SeasonRow): DashboardSeason => ({ seasonId: row.id, label: row.label, status: row.status, startDate: day(row.startDate), endDate: row.endDate ? day(row.endDate) : null });

export function dashboardSeasonRepository(db: PrismaClient): DashboardSeasons {
  return {
    async seasons(scope) {
      const rows = await db.season.findMany({ where: { tenantId: scope.tenantId, farmId: scope.farmId }, select: seasonSelect, orderBy: [{ startDate: "desc" }, { id: "asc" }], take: MAX_DASHBOARD_SEASONS });
      return rows.map(view);
    },
    async season(scope, seasonId) {
      const row = await db.season.findFirst({ where: { id: seasonId, tenantId: scope.tenantId, farmId: scope.farmId }, select: seasonSelect });
      return row ? view(row) : null;
    },
  };
}
