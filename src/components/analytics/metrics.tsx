import type { MetricsView } from "@/modules/analytics-profitability/contracts/profitability";
import type { MetricValue } from "@/modules/analytics-profitability/domain/metric";
import type { BatchMetrics, CropMetrics, StockValueLine } from "@/modules/analytics-profitability/domain/metrics";
import { formatMoney, formatNumber } from "@/components/accounting/labels";
import { MetricText } from "./dashboard";

const units: Record<string, { one: string; many: string }> = { KG: { one: "kg", many: "kg" }, BIRD: { one: "bird", many: "birds" }, EGG: { one: "egg", many: "eggs" } };
const unitName = (unit: string, count: "one" | "many") => units[unit]?.[count] ?? unit;
const acres = (metric: MetricValue) => metric.status === "AVAILABLE" ? formatNumber(metric.value) + (metric.value === "1" ? " acre" : " acres") : null;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <><dt>{label}</dt><dd className="text-right font-semibold">{children}</dd></>;
}
function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <li className="rounded-xl border border-border p-4">
    <h3 className="break-words font-semibold">{title}</h3>
    {note && <p className="mt-1 text-sm leading-6 text-foreground/75">{note}</p>}
    {children}
  </li>;
}
const figures = "mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1";
const soFar = "So far: figures can still change.";

function CropCard({ line }: { line: CropMetrics & { enterpriseName: string } }) {
  const area = acres(line.acres), about = [line.crops.join(", "), area].filter(Boolean).join(" · ");
  return <Card title={line.enterpriseName || "Enterprise"} note={about}>
    {line.soFar && <p className="mt-1 text-sm font-semibold">{soFar}</p>}
    <dl className={figures}>
      <Row label="Harvested">{formatNumber(line.harvestedKg)} kg</Row>
      <Row label="Kept after loss">{formatNumber(line.keptKg)} kg</Row>
      <Row label="Yield per acre"><MetricText metric={line.yieldPerAcre} format={value => formatNumber(value) + " kg"} /></Row>
      {line.currencies.flatMap(row => [
        <Row key={row.currency + "cost"} label={"Cost per acre (" + row.currency + ")"}><MetricText metric={row.costPerAcre} format={value => formatMoney(value, row.currency)} /></Row>,
        <Row key={row.currency + "revenue"} label={"Revenue per acre (" + row.currency + ")"}><MetricText metric={row.revenuePerAcre} format={value => formatMoney(value, row.currency)} /></Row>,
        <Row key={row.currency + "kg"} label={"Cost per kg, the price to break even (" + row.currency + ")"}><MetricText metric={row.costPerKg} format={value => formatMoney(value, row.currency)} /></Row>,
      ])}
    </dl>
  </Card>;
}

function BatchCard({ line }: { line: BatchMetrics }) {
  return <Card title={line.label} note={line.animalTypeName}>
    {line.soFar && <p className="mt-1 text-sm font-semibold">{soFar}</p>}
    <dl className={figures}>
      <Row label="Birds started">{formatNumber(line.birdsStarted)}</Row>
      <Row label="Birds that died">{formatNumber(line.deaths)}</Row>
      <Row label="Mortality rate"><MetricText metric={line.mortalityRate} format={value => value + "%"} /></Row>
      {line.currencies.flatMap(row => [
        <Row key={row.currency + "cost"} label={"Cost per bird (" + row.currency + ")"}><MetricText metric={row.costPerBird} format={value => formatMoney(value, row.currency)} /></Row>,
        <Row key={row.currency + "revenue"} label={"Revenue per bird (" + row.currency + ")"}><MetricText metric={row.revenuePerBird} format={value => formatMoney(value, row.currency)} /></Row>,
      ])}
    </dl>
    {line.currencies.filter(row => row.enterpriseCostsNotLinked !== "0").map(row => <p key={row.currency} className="mt-3 text-sm leading-6">{formatMoney(row.enterpriseCostsNotLinked, row.currency)} of this enterprise&apos;s costs are not linked to a batch, so cost per bird may be too low.</p>)}
  </Card>;
}

function StockCard({ line }: { line: StockValueLine }) {
  const price = line.pricePerUnit, currency = line.currency;
  return <Card title={line.name} note={formatNumber(line.quantity) + " " + unitName(line.unit, "many") + " in stock"}>
    {price.status === "AVAILABLE" && currency
      ? <dl className={figures}>
        <Row label="Estimated value"><MetricText metric={line.estimate} format={value => formatMoney(value, currency)} /></Row>
        <Row label={"Last sale price per " + unitName(line.unit, "one")}>{formatMoney(price.value, currency)}</Row>
        <Row label="Last sold"><time dateTime={line.soldOn ?? undefined}>{line.soldOn}</time></Row>
      </dl>
      : <p className="mt-3 leading-7"><MetricText metric={line.estimate} format={value => value} /></p>}
  </Card>;
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return <section aria-labelledby={id} className="mb-6 rounded-2xl border border-border bg-white p-5">
    <h2 id={id} className="text-xl font-semibold">{title}</h2>
    {intro && <p className="mt-2 leading-7">{intro}</p>}
    {children}
  </section>;
}
const list = "mt-4 grid gap-4 sm:grid-cols-2";

/** Every figure comes from the service; nothing is calculated here (R002). */
export function FarmMetrics({ view }: { view: MetricsView }) {
  return <>
    <Section id="metricCrops" title="Crops">
      {view.crops.length === 0 ? <p className="mt-2 leading-7">No crops in this view.</p>
        : <ul aria-label="Crop figures" className={list}>{view.crops.map(line => <CropCard key={line.enterpriseId} line={line} />)}</ul>}
    </Section>
    <Section id="metricBatches" title="Poultry batches" intro="Each batch shows its whole life, whichever season or dates you choose.">
      {view.batches.length === 0 ? <p className="mt-2 leading-7">No poultry batches on this farm.</p>
        : <ul aria-label="Batch figures" className={list}>{view.batches.map(line => <BatchCard key={line.batchId} line={line} />)}</ul>}
    </Section>
    <Section id="metricCosts" title="Labour and inputs" intro="Inputs are seeds, feed, fertilizer, veterinary care, medication and pesticides.">
      {view.costGroups.length === 0 ? <p className="mt-2 leading-7">No costs in this view.</p>
        : <ul aria-label="Costs by group" className={list}>{view.costGroups.map(row => <Card key={row.currency} title={"Amounts in " + row.currency}>
          <dl className={figures}>
            <Row label="Labour cost">{formatMoney(row.labour, row.currency)}</Row>
            <Row label="Input cost">{formatMoney(row.inputs, row.currency)}</Row>
            <Row label="Other costs">{formatMoney(row.other, row.currency)}</Row>
          </dl>
        </Card>)}</ul>}
    </Section>
    <Section id="metricStock" title="Stock value (estimate)" intro="This is what your stock could bring in at its last sale price. It is only an estimate, and it is not counted in your recorded surplus. It shows stock as it is today, whichever season or dates you choose.">
      {view.stock.items.length === 0 ? <p className="mt-2 leading-7">No stock on this farm.</p>
        : <ul aria-label="Stock value" className={list}>{view.stock.items.map(line => <StockCard key={line.itemId} line={line} />)}</ul>}
      {view.stock.totals.map(row => <p key={row.currency} className="mt-4 font-semibold">Estimated total: {formatMoney(row.estimate, row.currency)}</p>)}
    </Section>
  </>;
}
