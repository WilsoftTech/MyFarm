import type { TrendsView } from "@/modules/analytics-profitability/contracts/profitability";
import type { BatchTrend, CropTrend, TrendCurrency, TrendFigure, TrendFigureName } from "@/modules/analytics-profitability/domain/trends";
import { formatMoney, formatNumber } from "@/components/accounting/labels";
import { MetricText } from "./dashboard";

const figureNames: Record<TrendFigureName, string> = {
  COSTS: "Costs",
  COST_PER_ACRE: "Cost per acre",
  REVENUE_PER_ACRE: "Revenue per acre",
  COST_PER_KG: "Cost per kg",
  COST_PER_BIRD: "Cost per bird",
  REVENUE_PER_BIRD: "Revenue per bird",
};
const percent = (value: string) => value + "%";
const soFar = "So far: one side is still open, so figures can still change.";

/** Earlier, now and the change, each shown as the service gave it; a missing figure says why (D-P08-007). */
function Line({ label, figure, format }: { label: string; figure: TrendFigure; format: (value: string) => string }) {
  return <>
    <dt>{label}</dt>
    <dd className="text-right">
      <span className="block"><MetricText metric={figure.earlier} format={format} /> <span aria-hidden="true">→</span><span className="sr-only">then</span> <MetricText metric={figure.current} format={format} /></span>
      <span className="block font-semibold">Change: <MetricText metric={figure.change} format={percent} /></span>
    </dd>
  </>;
}

const rows = "mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2";

function Currency({ row, side }: { row: TrendCurrency; side: string }) {
  const money = (value: string) => formatMoney(value, row.currency);
  const loose = row.notLinked.current !== "0" || row.notLinked.earlier !== "0";
  return <div className="mt-4">
    <h4 className="font-semibold">Amounts in {row.currency}</h4>
    <dl className={rows}>{row.figures.map(line => <Line key={line.figure} label={figureNames[line.figure]} figure={line} format={money} />)}</dl>
    {row.categories.length > 0 && <>
      <h5 className="mt-3 text-sm font-semibold">By cost type</h5>
      <dl className={rows}>{row.categories.map(line => <Line key={line.categoryId} label={line.name || "Cost"} figure={line} format={money} />)}</dl>
    </>}
    {loose && <p className="mt-3 text-sm leading-6">Costs that may belong here but are not linked to {side}: {money(row.notLinked.current)} now and {money(row.notLinked.earlier)} before. The comparison may mislead.</p>}
  </div>;
}

function Card({ title, note, trend, side, children }: { title: string; note: string; trend: CropTrend | BatchTrend; side: string; children?: React.ReactNode }) {
  return <li className="rounded-xl border border-border p-4">
    <h3 className="break-words font-semibold">{title}</h3>
    <p className="mt-1 text-sm leading-6 text-foreground/75">{note}</p>
    {trend.soFar && <p className="mt-1 text-sm font-semibold">{soFar}</p>}
    {trend.unavailable
      ? <p className="mt-3 leading-7"><MetricText metric={{ status: "UNAVAILABLE", reason: trend.unavailable }} format={value => value} /></p>
      : <>{children}{trend.currencies.length === 0 && <p className="mt-3 leading-7">No money recorded on either side yet.</p>}{trend.currencies.map(row => <Currency key={row.currency} row={row} side={side} />)}</>}
  </li>;
}

function CropCard({ trend }: { trend: CropTrend }) {
  const note = trend.earlierSeason ? trend.season.label + " compared with " + trend.earlierSeason.label : "Season " + trend.season.label;
  return <Card title={trend.cropName} note={note} trend={trend} side="this crop's enterprise and season">
    {trend.yieldPerAcre && <dl className={rows}><Line label="Yield per acre" figure={trend.yieldPerAcre} format={value => formatNumber(value) + " kg"} /></dl>}
  </Card>;
}
function BatchCard({ trend }: { trend: BatchTrend }) {
  const note = trend.animalTypeName + (trend.earlierBatch ? ", compared with " + trend.earlierBatch.label : "");
  return <Card title={trend.label} note={note} trend={trend} side="a batch" />;
}

const list = "mt-4 grid gap-4 sm:grid-cols-2";

/** R003: how figures moved. Every figure comes from the service; nothing is calculated here, and nothing explains the change. */
export function FarmTrends({ view }: { view: TrendsView }) {
  return <section aria-labelledby="metricTrends" className="mb-6 rounded-2xl border border-border bg-white p-5">
    <h2 id="metricTrends" className="text-xl font-semibold">Compared with before</h2>
    <p className="mt-2 leading-7">Each crop is compared with the last earlier season that grew it, and each poultry batch with the batch of the same birds before it. This shows how figures moved, not why.</p>
    <h3 className="mt-5 text-lg font-semibold">Crops</h3>
    {view.cropsNeedSeason ? <p className="mt-2 leading-7">Choose a season above to compare its crops with an earlier season.</p>
      : view.crops.length === 0 ? <p className="mt-2 leading-7">No crops in this season.</p>
        : <ul aria-label="Crop trends" className={list}>{view.crops.map(trend => <CropCard key={trend.cropId} trend={trend} />)}</ul>}
    <h3 className="mt-6 text-lg font-semibold">Poultry batches</h3>
    {view.batches.length === 0 ? <p className="mt-2 leading-7">No poultry batches on this farm.</p>
      : <ul aria-label="Batch trends" className={list}>{view.batches.map(trend => <BatchCard key={trend.batchId} trend={trend} />)}</ul>}
  </section>;
}
