import { isThresholdEvidence, type InsightFeed, type InsightView, type ThresholdEvidence, type TrendEvidence } from "@/modules/farm-intelligence/contracts/insights";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { RULES } from "@/modules/farm-intelligence/domain/rules";
import { AcknowledgeForm } from "./acknowledge-form";
import { changeText, figureLabels, lossUnits, missingLabels, ruleTitles, severityLabels, thresholdFigureLabels, thresholdMissingLabels, valueText } from "./labels";

const weeks = (days: number[]) => days.join(", ");

function TrendDetails({ evidence }: { evidence: TrendEvidence }) {
  return <>
    <p className="mt-1 text-sm">Batch: {evidence.batchLabel}</p>
    <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
      {evidence.figures.map(figure => <div key={figure.rule} className="contents">
        <dt>{figureLabels[figure.rule]}</dt>
        <dd className="text-right">
          {figure.earlier !== null && figure.current !== null && <span className="block">{valueText(figure.rule, figure.earlier, figure.currency)} <span aria-hidden="true">→</span><span className="sr-only">then</span> {valueText(figure.rule, figure.current, figure.currency)}</span>}
          {figure.change !== null && <span className="block font-semibold">Change: {changeText(figure.rule, figure.change)}</span>}
        </dd>
      </div>)}
    </dl>
    <p className="mt-4 text-sm leading-6">Last 4 weeks: {evidence.windows.current.from} to {evidence.windows.current.to}. Compared with {evidence.windows.earlier.from} to {evidence.windows.earlier.to}.</p>
    <p className="text-sm leading-6">Days with records each week: {weeks(evidence.coverage.earlier.recordedDays)} before, then {weeks(evidence.coverage.current.recordedDays)}. Birds at the start: {evidence.coverage.earlier.birdsAtStart}, then {evidence.coverage.current.birdsAtStart}.</p>
  </>;
}

/** One figure against its threshold, with the inputs it came from (MYF-P10-AC002: thresholds and demand stated, units compared). */
function ThresholdDetails({ evidence }: { evidence: ThresholdEvidence }) {
  const { figure } = evidence, v = figure.values, money = (value: string | undefined) => (value ?? "") + " " + (figure.currency ?? "");
  const lines: [string, string][] = figure.rule === "HIGH_MORTALITY" ? [["Birds that died", v.deaths + " of " + v.birdsAtRisk + " (" + v.rate + "%)"], ["Days with records", v.recordedDays + " of 7"]]
    : figure.rule === "FEED_RUNNING_LOW" ? [["Feed item", v.itemName], ["In stock", v.stockKg + " kg"], ["Feed given a day, every batch fed from it", v.dailyUseKg + " kg"], ["Lasts about", v.daysLeft + " days"], ["Days with feed given each week", v.feedDays]]
    : [[`Cost per ${lossUnits[figure.rule].one}`, money(v.costPerUnit) + " (" + money(v.costs).trim() + " for " + v.produced + " " + lossUnits[figure.rule].many + ")"],
       [`Average price per ${lossUnits[figure.rule].one} sold`, money(v.pricePerUnit) + " (" + money(v.sales).trim() + " for " + v.sold + " " + lossUnits[figure.rule].many + ")"]];
  const span = figure.window ? `${figure.window.from} to ${figure.window.to}` : evidence.subject.kind === "CROP_CYCLE" ? "this season so far" : "the whole batch so far";
  return <>
    <p className="mt-1 text-sm">{evidence.subject.kind === "CROP_CYCLE" ? "Crop" : "Batch"}: {evidence.subject.label}</p>
    <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2">
      {lines.map(([label, value]) => <div key={label} className="contents"><dt>{label}</dt><dd className="text-right font-semibold">{value}</dd></div>)}
    </dl>
    <p className="mt-4 text-sm leading-6">Period: {span}.</p>
  </>;
}

const nextStep: Record<InsightView["ruleKey"], string> = {
  FEED_COST_RISING: "Check what changed on this batch in the last 4 weeks.", EGGS_FALLING: "Check what changed on this batch in the last 4 weeks.",
  MORTALITY_RISING: "Check what changed on this batch in the last 4 weeks.", PRODUCTION_FALLING_COSTS_RISING: "Check what changed on this batch in the last 4 weeks.",
  // D-P10-003: the approved wording sends the farmer to someone who can examine the birds.
  HIGH_MORTALITY: "Have a vet or extension officer look at the flock.",
  FEED_RUNNING_LOW: "Check how much feed is in store and when more will come.",
  LOSS_PER_EGG: "Check the costs linked to this batch and the prices you sell at.", LOSS_PER_BIRD: "Check the costs linked to this batch and the prices you sell at.",
  LOSS_PER_KG: "Check the costs linked to this crop and the prices you sell at.",
};

/** One insight with everything it was raised on (MYF-P10-AC001, AC002): values, period, coverage and the rule version. */
function InsightCard({ insight, acknowledge }: { insight: InsightView; acknowledge: (insightId: string, version: number) => CommandSubmit }) {
  const { evidence } = insight, rule = RULES[insight.ruleKey], title = ruleTitles[insight.ruleKey];
  const headingId = "insight-" + insight.insightId;
  return <li><article aria-labelledby={headingId} className="rounded-2xl border border-border bg-white p-5">
    <p className={"inline-block rounded-full px-3 py-1 text-sm font-semibold " + (insight.severity === "WARNING" ? "bg-foreground text-background" : "bg-muted")}>{severityLabels[insight.severity]}</p>
    <h3 id={headingId} className="mt-3 text-xl font-semibold">{title}</h3>
    {isThresholdEvidence(evidence) ? <ThresholdDetails evidence={evidence} /> : <TrendDetails evidence={evidence} />}
    <p className="text-sm leading-6">Rule: {rule.threshold} (version {insight.ruleVersion}). Worked out from this farm&apos;s own records on {insight.evaluatedOn}.</p>
    <p className="mt-3 leading-7">{nextStep[insight.ruleKey]}</p>
    {insight.status === "OPEN" ? <AcknowledgeForm key={insight.insightId + ":" + insight.version} title={title} version={insight.version} submit={acknowledge(insight.insightId, insight.version)} />
      : <p className="mt-4 rounded-xl bg-muted p-3 text-sm">You marked this as seen{insight.acknowledgedAt ? " on " + insight.acknowledgedAt.slice(0, 10) : ""}. It comes back only if the figure gets worse.</p>}
  </article></li>;
}

export function InsightFeedView({ feed, acknowledge }: { feed: InsightFeed; acknowledge: (insightId: string, version: number) => CommandSubmit }) {
  const nothing = feed.batchesChecked === 0 && feed.cropCyclesChecked === 0;
  return <>
    <p className="max-w-3xl leading-7">MyFarm checks each active poultry batch and crop against fixed rules, using only the records on this farm: changes over the last 4 weeks, deaths in the last week, feed in stock, and costs against the prices you sell at. These are fixed rules, not advice. They need regular records to say anything.</p>
    {feed.batchesTruncated && <p role="status" className="mt-4 rounded-xl bg-muted p-4">Only the newest {feed.batchesChecked} active batches were checked.</p>}
    <h2 className="mt-8 text-2xl font-semibold">Alerts</h2>
    {feed.insights.length === 0 ? <p className="mt-3 leading-7">{nothing ? "No active poultry batch or crop to check. Alerts appear here once there are records to compare." : "No alerts. Nothing has gone past the rules on what could be checked."}</p>
      : <ul className="mt-4 space-y-4">{feed.insights.map(insight => <InsightCard key={insight.insightId} insight={insight} acknowledge={acknowledge} />)}</ul>}
    {(feed.notJudged.length > 0 || feed.thresholdsNotJudged.length > 0) && <>
      <h2 className="mt-10 text-2xl font-semibold">Not enough records to check</h2>
      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">
        {feed.notJudged.map(row => <li key={row.batchId + row.rule + (row.currency ?? "")} className="p-4">
          <p className="font-semibold">{row.batchLabel}: {figureLabels[row.rule]}{row.currency ? " (" + row.currency + ")" : ""}</p>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">{row.missing.map(reason => <li key={reason}>{missingLabels[reason]}</li>)}</ul>
        </li>)}
        {feed.thresholdsNotJudged.map(row => <li key={row.subject.id + row.rule + (row.currency ?? "")} className="p-4">
          <p className="font-semibold">{row.subject.label}: {thresholdFigureLabels[row.rule]}{row.currency ? " (" + row.currency + ")" : ""}</p>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">{row.missing.map(reason => <li key={reason}>{thresholdMissingLabels[reason]}</li>)}</ul>
        </li>)}
      </ul>
    </>}
  </>;
}
