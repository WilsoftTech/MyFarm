import Link from "next/link";
import type { DashboardView } from "@/modules/analytics-profitability/contracts/profitability";
import type { MetricValue, UnavailableReason } from "@/modules/analytics-profitability/domain/metric";
import type { CurrencyDashboard } from "@/modules/analytics-profitability/domain/profitability";
import { formatMoney } from "@/components/accounting/labels";

const unavailableText: Record<UnavailableReason, string> = {
  NO_REVENUE: "Not available: no money earned yet.",
  NO_AREA: "Not available: no planted area recorded.",
  NO_HARVEST: "Not available: no harvest to count yet.",
  MORE_THAN_ONE_CROP: "Not available: this enterprise has more than one crop.",
  DATE_RANGE: "Not available for chosen dates. Choose a season or all records.",
  NO_BIRDS: "Not available: no birds recorded in this batch.",
  NEVER_SOLD: "Not available: not sold yet.",
  NO_EARLIER_SEASON: "Not available: no earlier season grew this crop.",
  NO_EARLIER_BATCH: "Not available: no earlier batch of these birds.",
  NO_BASELINE: "Not available: nothing earlier to compare with.",
};

/** A figure, or the plain reason it cannot be worked out (D-P08-007). Never a 0 standing in for "unknown". */
export function MetricText({ metric, format }: { metric: MetricValue; format: (value: string) => string }) {
  return metric.status === "AVAILABLE" ? <>{format(metric.value)}</> : <span className="text-sm font-normal">{unavailableText[metric.reason]}</span>;
}
const percent = (value: string) => value + "%";

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-4"><dt className="text-sm text-foreground/70">{label}</dt><dd className="mt-1 break-words text-xl font-semibold">{children}</dd></div>;
}

function CurrencySection({ currency }: { currency: CurrencyDashboard }) {
  const code = currency.currency, top = new Set(currency.topEnterpriseIds);
  return <section aria-labelledby={"dash-" + code} className="mb-6 rounded-2xl border border-border bg-white p-5">
    <h2 id={"dash-" + code} className="text-xl font-semibold">Amounts in {code}</h2>
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Figure label="Money earned">{formatMoney(currency.revenue, code)}</Figure>
      <Figure label="Money spent">{formatMoney(currency.expenses, code)}</Figure>
      <Figure label="Recorded surplus">{formatMoney(currency.recordedSurplus, code)}</Figure>
      <Figure label="Margin"><MetricText metric={currency.surplusMargin} format={percent} /></Figure>
    </dl>
    <p className="mt-3 text-sm leading-6 text-foreground/75">Recorded surplus is money earned minus money spent. Margin is how much of each 100 earned is left.</p>
    <h3 className="mt-6 text-lg font-semibold">Compare enterprises</h3>
    {currency.enterprises.length === 0 ? <p className="mt-2 leading-7">No money in {code} is linked to an enterprise in this view.</p>
      : <ul aria-label={"Enterprises in " + code} className="mt-3 grid gap-4 sm:grid-cols-2">{currency.enterprises.map(line => <li key={line.enterpriseId} className="rounded-xl border border-border p-4">
        <h4 className="break-words font-semibold">{line.name || "Enterprise"}{top.has(line.enterpriseId) && <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-sm font-normal">Highest</span>}</h4>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt>Money from it</dt><dd className="text-right">{formatMoney(line.revenue, code)}</dd>
          <dt>Its costs</dt><dd className="text-right">{formatMoney(line.directCosts, code)}</dd>
          <dt className="font-semibold">Gross margin</dt><dd className="text-right font-semibold">{formatMoney(line.grossMargin, code)}</dd>
          <dt>Margin</dt><dd className="text-right"><MetricText metric={line.marginPercent} format={percent} /></dd>
        </dl>
      </li>)}</ul>}
    <p className="mt-4 leading-7">All enterprises together: gross margin {formatMoney(currency.allEnterprises.grossMargin, code)}.</p>
    <p className="mt-1 leading-7">Not linked to an enterprise: money earned {formatMoney(currency.unassigned.revenue, code)}, money spent {formatMoney(currency.unassigned.costs, code)}. These count in the recorded surplus and are not shared out among enterprises.</p>
  </section>;
}

/** Every figure on this screen comes from the service; nothing is calculated here. */
export function FarmDashboard({ view, moneyPath }: { view: DashboardView; moneyPath: string }) {
  return <>
    {view.notLinkedToSeason.length > 0 && <section aria-label="Not linked to a season" className="mb-6 rounded-xl border border-border bg-white p-4 leading-7">
      <p>These records have no season, so they are not counted in {view.season?.label}:</p>
      <ul className="mt-1">{view.notLinkedToSeason.map(row => <li key={row.currency}>Money earned {formatMoney(row.revenue, row.currency)}, money spent {formatMoney(row.costs, row.currency)}</li>)}</ul>
    </section>}
    {view.currencies.length === 0
      ? <section className="rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">No money records in this view</h2>
        <p className="mt-2 leading-7">{view.season ? "No money record is linked to " + view.season.label + " yet. Choose this season when you record money, or look at all records." : "Figures appear here once you record money on this farm."}</p>
        <Link href={moneyPath} className="mt-4 inline-flex min-h-12 items-center py-2 underline underline-offset-4">Go to money records</Link></section>
      : view.currencies.map(currency => <CurrencySection key={currency.currency} currency={currency} />)}
  </>;
}
