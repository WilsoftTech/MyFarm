import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmProfitabilityService } from "@/modules/analytics-profitability/infrastructure/services";
import { ALL_RECORDS, dashboardQuerySchema } from "@/modules/analytics-profitability/contracts/profitability";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { ReportFilters, ReportLabelsNote } from "@/components/accounting/report-parts";
import { FarmDashboard } from "@/components/analytics/dashboard";
import { FarmMetrics } from "@/components/analytics/metrics";
import { Select } from "@/components/ui/select";
export const dynamic = "force-dynamic";
export const metadata = { title: "How the farm is doing" };
type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function HowTheFarmIsDoingPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Search }) {
  const { farmId } = await params, search = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const input = { basis: search.basis, seasonId: search.seasonId, from: search.from, to: search.to };
  const valid = dashboardQuerySchema.safeParse(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
  const filters = valid.success ? valid.data : {};
  const [view, metrics] = await loadPage(() => Promise.all([farmProfitabilityService().dashboard(farmId, filters), farmProfitabilityService().metrics(farmId, filters)]));
  const base = "/farms/" + farm.farmId + "/accounting";
  return <AccountingShell farm={farm} title="How the farm is doing">
    <p className="mb-5 max-w-3xl leading-7">This adds up the money records on this farm. It does not include wear on tools and equipment or the cost of loans, because MyFarm does not record those yet, so it is not your full profit. Stock you have not sold is not counted.</p>
    <ReportFilters action={base + "/how-the-farm-is-doing"} labels={view} error={valid.success ? undefined : valid.error.issues.some(issue => issue.path[0] === "seasonId") ? "To use dates, choose all records instead of one season." : "Check the dates: use real dates, with the end on or after the start."} before={<div className="sm:col-span-4">
      <label htmlFor="reportSeason" className="field-label">Season</label>
      <Select id="reportSeason" name="seasonId" defaultValue={view.season?.seasonId ?? ALL_RECORDS}>
        {view.seasons.map(season => <option key={season.seasonId} value={season.seasonId}>{season.label}{season.status === "CLOSED" ? " (closed)" : ""}</option>)}
        <option value={ALL_RECORDS}>All records, or the dates below</option>
      </Select>
    </div>} />
    <p className="mb-2 leading-7">{view.season ? "Showing season " + view.season.label + ": only records linked to it." : "Showing records from every season."}</p>
    <ReportLabelsNote labels={view} />
    <FarmDashboard view={view} moneyPath={base} />
    <FarmMetrics view={metrics} />
  </AccountingShell>;
}
