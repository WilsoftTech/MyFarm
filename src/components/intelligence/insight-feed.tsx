import type { InsightFeed, InsightView } from "@/modules/farm-intelligence/contracts/insights";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { RULES } from "@/modules/farm-intelligence/domain/rules";
import { AcknowledgeForm } from "./acknowledge-form";
import { changeText, figureLabels, missingLabels, ruleTitles, severityLabels, valueText } from "./labels";

const weeks = (days: number[]) => days.join(", ");

/** One insight with everything it was raised on (MYF-P10-AC001): values, both periods, coverage and the rule version. */
function InsightCard({ insight, acknowledge }: { insight: InsightView; acknowledge: (insightId: string, version: number) => CommandSubmit }) {
  const { evidence } = insight, rule = RULES[insight.ruleKey], title = ruleTitles[insight.ruleKey];
  const headingId = "insight-" + insight.insightId;
  return <li><article aria-labelledby={headingId} className="rounded-2xl border border-border bg-white p-5">
    <p className={"inline-block rounded-full px-3 py-1 text-sm font-semibold " + (insight.severity === "WARNING" ? "bg-foreground text-background" : "bg-muted")}>{severityLabels[insight.severity]}</p>
    <h3 id={headingId} className="mt-3 text-xl font-semibold">{title}</h3>
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
    <p className="text-sm leading-6">Rule: {rule.threshold} (version {insight.ruleVersion}). Worked out from this farm&apos;s own records on {insight.evaluatedOn}.</p>
    <p className="mt-3 leading-7">Check what changed on this batch in the last 4 weeks.</p>
    {insight.status === "OPEN" ? <AcknowledgeForm key={insight.insightId + ":" + insight.version} title={title} version={insight.version} submit={acknowledge(insight.insightId, insight.version)} />
      : <p className="mt-4 rounded-xl bg-muted p-3 text-sm">You marked this as seen{insight.acknowledgedAt ? " on " + insight.acknowledgedAt.slice(0, 10) : ""}. It comes back only if the figure gets worse.</p>}
  </article></li>;
}

export function InsightFeedView({ feed, acknowledge }: { feed: InsightFeed; acknowledge: (insightId: string, version: number) => CommandSubmit }) {
  return <>
    <p className="max-w-3xl leading-7">MyFarm compares each active poultry batch&apos;s last 4 weeks with the 4 weeks before, using only the records on this farm. These are fixed rules, not advice. They need records on most days to say anything.</p>
    {feed.batchesTruncated && <p role="status" className="mt-4 rounded-xl bg-muted p-4">Only the newest {feed.batchesChecked} active batches were checked.</p>}
    <h2 className="mt-8 text-2xl font-semibold">Alerts</h2>
    {feed.insights.length === 0 ? <p className="mt-3 leading-7">{feed.batchesChecked === 0 ? "No active poultry batch to check. Alerts appear here once a batch has at least 8 weeks of records." : "No alerts. Nothing has changed past the rules on the batches that could be checked."}</p>
      : <ul className="mt-4 space-y-4">{feed.insights.map(insight => <InsightCard key={insight.insightId} insight={insight} acknowledge={acknowledge} />)}</ul>}
    {feed.notJudged.length > 0 && <>
      <h2 className="mt-10 text-2xl font-semibold">Not enough records to check</h2>
      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-white">{feed.notJudged.map(row =>
        <li key={row.batchId + row.rule + (row.currency ?? "")} className="p-4">
          <p className="font-semibold">{row.batchLabel}: {figureLabels[row.rule]}{row.currency ? " (" + row.currency + ")" : ""}</p>
          <ul className="mt-1 list-disc pl-5 text-sm leading-6">{row.missing.map(reason => <li key={reason}>{missingLabels[reason]}</li>)}</ul>
        </li>)}</ul>
    </>}
  </>;
}
