import type { CohortView } from "@/modules/field-pilot/contracts/pilot";
import type { GateCheck, ParticipantWeek } from "@/modules/field-pilot/domain/measures";
import { pilotValue } from "./labels";

function Figure({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return <div className="rounded-xl border border-border p-4"><dt className="text-sm text-foreground/70">{label}</dt><dd className="mt-1 break-words text-xl font-semibold">{children}</dd>{note && <p className="mt-1 text-sm text-foreground/70">{note}</p>}</div>;
}
function Gate({ title, check, week }: { title: string; check: GateCheck | null; week: number }) {
  return <div className="rounded-xl border border-border p-4">
    <h3 className="font-semibold">{title}</h3>
    {check ? <p className="mt-1 leading-7"><strong>{check.met ? "Met" : "Not met"}</strong>: {check.retainedVoluntarily} of {check.onboarded} farmers kept using MyFarm without a reminder (at least half needed).</p>
      : <p className="mt-1 leading-7">Not judged yet: week {week} has not ended.</p>}
  </div>;
}
const mark = (row: ParticipantWeek) => row.voluntary ? "Used" : row.prompted && row.active ? "Used after reminder" : row.prompted ? "Reminded" : "No records";

/** Staff view of one cohort: measures and code names only, never names, money or records (D-P09-007). Nothing is calculated here. */
export function CohortMeasures({ view }: { view: CohortView }) {
  const m = view.measures, week = m.weeks.at(-1);
  return <>
    <section aria-labelledby="measuresHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="measuresHeading" className="text-xl font-semibold">The ten measures</h2>
      <p className="mt-1 text-sm text-foreground/75">Week {m.currentWeek} of the cohort{week?.soFar ? ", so far" : ""}. Each saved record is counted once, however many times a phone retried it.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Figure label="Farmers onboarded">{m.onboarded}</Figure>
        <Figure label="Kept using it without a reminder" note="Active in 3 of the last 4 weeks, this week">{week ? week.retainedVoluntarily + " · " + pilotValue(week.retainedShare) : pilotValue({ status: "UNAVAILABLE", reason: "NO_FARMERS" })}</Figure>
        <Figure label="Records per farmer this week">{week ? pilotValue(week.recordsPerFarmer, "") : pilotValue({ status: "UNAVAILABLE", reason: "NO_FARMERS" })}</Figure>
        <Figure label="Expenses recorded">{m.expensesRecorded}</Figure>
        <Figure label="Harvests recorded">{m.harvestsRecorded}</Figure>
        <Figure label="Tasks completed">{m.tasksCompleted}</Figure>
        <Figure label="Entries sent from phones">{m.offlineTransactions}</Figure>
        <Figure label="Sync failures" note="Entries the server refused; attempts that never reached it are not seen">{m.syncFailures} · {pilotValue(m.syncFailureShare)}</Figure>
        <Figure label="Support incidents">{m.support.total} ({m.support.open} open)</Figure>
        <Figure label="Farmers who finished a crop or batch">{m.farmersCompletingCycle} · {pilotValue(m.completingCycleShare)}</Figure>
      </dl>
    </section>
    <section aria-labelledby="gateHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="gateHeading" className="text-xl font-semibold">Are farmers continuing without being pushed?</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><Gate title="Week 8 check" check={m.gates.atWeek8} week={8} /><Gate title="End of pilot check" check={m.gates.atEnd} week={Math.max(m.currentWeek, 1)} /></div>
    </section>
    <section aria-labelledby="weeksHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="weeksHeading" className="text-xl font-semibold">Week by week</h2>
      {m.weeks.length === 0 ? <p className="mt-2 leading-7">The cohort has not started yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm">
        <thead><tr className="border-b border-border"><th scope="col" className="py-2 pr-3">Week</th><th scope="col" className="py-2 pr-3">Farmers in</th><th scope="col" className="py-2 pr-3">Active</th><th scope="col" className="py-2 pr-3">Records</th><th scope="col" className="py-2 pr-3">Per farmer</th><th scope="col" className="py-2">Kept using, unprompted</th></tr></thead>
        <tbody>{m.weeks.map(row => <tr key={row.week} className="border-b border-border/60"><th scope="row" className="py-2 pr-3 font-normal">{row.week}{row.soFar ? " (so far)" : ""}</th><td className="py-2 pr-3">{row.joined}</td><td className="py-2 pr-3">{row.activeFarmers}</td><td className="py-2 pr-3">{row.records}</td><td className="py-2 pr-3">{pilotValue(row.recordsPerFarmer, "")}</td><td className="py-2">{row.retainedVoluntarily} · {pilotValue(row.retainedShare)}</td></tr>)}</tbody>
      </table></div>}
    </section>
    <section aria-labelledby="farmersHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="farmersHeading" className="text-xl font-semibold">Farmers, by code name</h2>
      {m.participants.length === 0 ? <p className="mt-2 leading-7">No farmer has joined yet. Give farmers the code {view.cohort.code}.</p>
        : <ul aria-label="Farmers by code name" className="mt-3 space-y-2">{m.participants.map(series => <li key={series.participationId} className="rounded-xl border border-border p-3">
          <p className="font-semibold">{series.pseudonym} <span className="font-normal text-foreground/70">· joined in week {series.joinedWeek}</span></p>
          <p className="mt-1 text-sm leading-6">{series.weeks.length === 0 ? "No full week yet." : series.weeks.map(row => "Week " + row.week + ": " + mark(row)).join(" · ")}</p>
        </li>)}</ul>}
    </section>
  </>;
}
