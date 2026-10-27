import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmReportService } from "@/modules/farm-accounting/infrastructure/services";
import { reportQuerySchema } from "@/modules/farm-accounting/contracts/accounting";
import { loadPage } from "@/app/farmer/guard";
import { AccountingShell } from "@/components/accounting/shell";
import { ReportFilters, ReportLabelsNote } from "@/components/accounting/report-parts";
import { formatMoney } from "@/components/accounting/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Gross margin" };
type Search = Promise<Record<string, string | string[] | undefined>>;
export default async function GrossMarginPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Search }) {
  const { farmId } = await params, search = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const input = { basis: search.basis, from: search.from, to: search.to };
  const valid = reportQuerySchema.safeParse(Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)));
  const report = await loadPage(() => farmReportService().grossMargin(farmId, valid.success ? valid.data : {}));
  const names = new Map(report.enterprises.map(row => [row.enterpriseId, row.name]));
  const base = "/farms/" + farm.farmId + "/accounting";
  return <AccountingShell farm={farm} title="Gross margin">
    <p className="mb-5 max-w-3xl leading-7">Gross margin is the money from an enterprise minus the costs linked to that enterprise. It is not profit: spending that is not linked to an enterprise, such as rent, is shown separately and not taken off.</p>
    <ReportFilters action={base + "/gross-margin"} labels={report} error={valid.success ? undefined : "Check the dates: use real dates, with the end on or after the start. Showing all records instead."} />
    <ReportLabelsNote labels={report} />
    {report.currencies.length === 0 ? <div className="rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">No money records in this period</h2><p className="mt-3 leading-7">Add sales and costs linked to an enterprise to see its gross margin.</p></div>
      : report.currencies.map(currency => <section key={currency.currency} aria-labelledby={"gm-" + currency.currency} className="mb-6 rounded-2xl border border-border bg-white p-6">
        <h2 id={"gm-" + currency.currency} className="text-xl font-semibold">Amounts in {currency.currency}</h2>
        {currency.enterprises.length === 0 ? <p className="mt-3 leading-7">No money in {currency.currency} is linked to an enterprise in this period.</p>
          : <ul aria-label={"Gross margin by enterprise in " + currency.currency} className="mt-4 grid gap-4 sm:grid-cols-2">{currency.enterprises.map(line => <li key={line.enterpriseId} className="min-w-0 rounded-xl border border-border p-4">
            <h3 className="break-words text-lg font-semibold">{names.get(line.enterpriseId) ?? "Enterprise"}</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1"><dt>Money from it</dt><dd className="text-right">{formatMoney(line.revenue, currency.currency)}</dd><dt>Direct costs</dt><dd className="text-right">{formatMoney(line.directCosts, currency.currency)}</dd><dt className="font-semibold">Gross margin</dt><dd className="text-right font-semibold">{formatMoney(line.grossMargin, currency.currency)}</dd></dl>
          </li>)}</ul>}
        <dl className="mt-5 grid gap-1 border-t border-border pt-4 sm:grid-cols-3"><div><dt className="text-sm text-foreground/70">All enterprises: money from them</dt><dd className="font-semibold">{formatMoney(currency.farm.revenue, currency.currency)}</dd></div><div><dt className="text-sm text-foreground/70">Direct costs</dt><dd className="font-semibold">{formatMoney(currency.farm.directCosts, currency.currency)}</dd></div><div><dt className="text-sm text-foreground/70">Gross margin</dt><dd className="text-xl font-semibold">{formatMoney(currency.farm.grossMargin, currency.currency)}</dd></div></dl>
        <p className="mt-4 text-sm leading-6 text-foreground/75">Not linked to an enterprise (not included above): money received {formatMoney(currency.unassigned.revenue, currency.currency)}, money spent {formatMoney(currency.unassigned.costs, currency.currency)}.</p>
      </section>)}
  </AccountingShell>;
}
