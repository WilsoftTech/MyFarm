import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmReportService } from "@/modules/farm-accounting/infrastructure/services";
import { reportQuerySchema } from "@/modules/farm-accounting/contracts/accounting";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { ReportFilters, ReportLabelsNote, reportHref } from "@/components/accounting/report-parts";
import { formatMoney } from "@/components/accounting/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Money summary" };
type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function MoneySummaryPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Search }) {
  const { farmId } = await params, search = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const input = { basis: search.basis, from: search.from, to: search.to };
  const valid = reportQuerySchema.safeParse(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
  const report = await loadPage(() => farmReportService().summary(farmId, valid.success ? valid.data : {}));
  const names = new Map(report.enterprises.map(row => [row.enterpriseId, row.name]));
  const base = "/farms/" + farm.farmId + "/accounting";
  return <AccountingShell farm={farm} title="Money summary">
    <p className="mb-5 max-w-3xl leading-7">How much this farm spent and earned, what the money was spent on, and which enterprise cost the most.</p>
    <ReportFilters action={base + "/summary"} labels={report} error={valid.success ? undefined : "Check the dates: use real dates, with the end on or after the start. Showing all records instead."} />
    <ReportLabelsNote labels={report} />
    <p className="mb-6"><a className="inline-flex min-h-12 items-center underline" href={reportHref("/api/v1/farms/" + farm.farmId + "/accounting/summary/export", report)} download>Download this summary (CSV)</a></p>
    {report.currencies.length === 0 ? <div className="rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">No money records in this period</h2><p className="mt-3 leading-7">Add expenses, sales, purchases or other income to see a summary.</p></div>
      : report.currencies.map(currency => <section key={currency.currency} aria-labelledby={"sum-" + currency.currency} className="mb-6 rounded-2xl border border-border bg-white p-6">
        <h2 id={"sum-" + currency.currency} className="text-xl font-semibold">Amounts in {currency.currency}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-foreground/70">Money spent</dt><dd className="text-2xl font-semibold">{formatMoney(currency.spent, currency.currency)}</dd></div>
          <div><dt className="text-sm text-foreground/70">Revenue earned</dt><dd className="text-2xl font-semibold">{formatMoney(currency.revenue, currency.currency)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-sm text-foreground/70">Enterprise costing the most</dt><dd className="break-words font-semibold">{currency.costliest.enterpriseIds.length === 0 ? "No spending is linked to an enterprise yet."
            : currency.costliest.enterpriseIds.map(id => names.get(id) ?? "Enterprise").join(" and ") + (currency.costliest.enterpriseIds.length > 1 ? " (tied)" : "") + ": " + formatMoney(currency.costliest.costs, currency.currency)}</dd></div>
        </dl>
        <h3 className="mt-6 text-lg font-semibold">What the money was spent on</h3>
        {currency.spending.length === 0 ? <p className="mt-2 leading-7">No spending in {currency.currency} in this period.</p>
          : <ul aria-label={"Spending by category in " + currency.currency} className="mt-2 divide-y divide-border">{currency.spending.map(category => <li key={category.categoryId ?? category.categoryName} className="flex flex-wrap justify-between gap-x-4 py-2"><span className="break-words">{category.categoryName}</span><span className="font-semibold">{formatMoney(category.amount, currency.currency)}</span></li>)}</ul>}
        <p className="mt-4 text-sm leading-6 text-foreground/75">Spending not linked to an enterprise: {formatMoney(currency.unassignedCosts, currency.currency)}.</p>
      </section>)}
  </AccountingShell>;
}
