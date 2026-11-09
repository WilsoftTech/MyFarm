import Link from "next/link";
import { fieldPilotService, pilotEvidenceService } from "@/modules/field-pilot/infrastructure/services";
import { CloseFindingForm, FindingForm, ObservationForm, ReviewForm } from "@/components/pilot/evidence-forms";
import { decisionLabels, kindLabels, screenLabels } from "@/components/pilot/labels";
import { loadPage } from "@/app/farmer/guard";
import { closeFindingAction, createFindingAction, recordObservationAction, recordReviewAction } from "../../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pilot evidence" };

const saved: Record<string, string> = { observation: "Observation recorded.", finding: "Finding saved.", closed: "Finding closed.", review: "Decision recorded." };
const findingStatus = { OPEN: "Open", ACTIONED: "Acted on", DISMISSED: "Dismissed" } as const;

/** R002: what staff saw, what they concluded, and the decision, on dated evidence; never downloads (P0557). */
export default async function PilotEvidencePage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<{ scope?: string; saved?: string; at?: string }> }) {
  const [{ cohortId }, search] = await Promise.all([params, searchParams]);
  const scope = search.scope ?? "";
  const [view, cohort] = await loadPage(() => Promise.all([pilotEvidenceService().evidenceView(scope, cohortId), fieldPilotService().cohortView(scope, cohortId)]));
  const choices = cohort.participants.map(row => ({ participationId: row.participationId, pseudonym: row.pseudonym }));
  const gate = view.gate;
  return <section className="mx-auto max-w-4xl space-y-6">
    <div>
      <Link href={"/admin/pilot/" + view.cohort.cohortId + "?scope=" + encodeURIComponent(scope)} className="text-sm underline underline-offset-4">Back to {view.cohort.name}</Link>
      <h1 className="mt-2 text-3xl font-bold">Observations and decision</h1>
      <p className="mt-2 leading-7">Write down where farmers hesitate or misunderstand, group what you see into findings, and decide whether farmers keep using MyFarm on their own. Downloads do not count as evidence.</p>
      {search.saved && saved[search.saved] && <p role="status" className="mt-3 rounded-xl bg-muted p-4">{saved[search.saved]}</p>}
    </div>
    <section aria-labelledby="observeHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="observeHeading" className="text-xl font-semibold">Observations</h2>
      <div className="mt-3"><ObservationForm key={"observation" + search.at} submit={recordObservationAction.bind(null, scope, view.cohort.cohortId)} choices={choices} today={view.today} /></div>
      {view.observations.length === 0 ? <p className="mt-4 leading-7">No observations yet.</p> : <ul aria-label="Observations" className="mt-4 space-y-2">{view.observations.map(row => <li key={row.observationId} className="rounded-xl border border-border p-3">
        <p className="text-sm font-semibold"><time dateTime={row.observedOn}>{row.observedOn}</time> · {screenLabels[row.screen]} · {kindLabels[row.kind]} · {row.pseudonym ?? "Not about one farmer"}</p>
        <p className="mt-1 leading-7">{row.note}</p>
      </li>)}</ul>}
    </section>
    <section aria-labelledby="findingsHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="findingsHeading" className="text-xl font-semibold">Findings</h2>
      {view.findings.length > 0 && <ul aria-label="Findings" className="mt-3 space-y-3">{view.findings.map(row => <li key={row.findingId} className="rounded-xl border border-border p-3">
        <p className="font-semibold">{row.title} <span className="font-normal text-foreground/70">· {findingStatus[row.status]}</span></p>
        <p className="mt-1 text-sm">{row.evidence.length === 0 ? "No evidence left: the farmers it was about have left the pilot." : row.evidence.length + (row.evidence.length === 1 ? " observation" : " observations") + ", " + row.earliest + (row.latest !== row.earliest ? " to " + row.latest : "")}</p>
        {row.status === "OPEN" && <CloseFindingForm submit={closeFindingAction.bind(null, scope, view.cohort.cohortId, row.findingId)} version={row.version} label={"Close finding " + row.title} />}
      </li>)}</ul>}
      <div className="mt-4">{view.observations.length === 0 ? <p className="leading-7">Record an observation first; a finding must point at what you saw.</p> : <FindingForm key={"finding" + search.at} submit={createFindingAction.bind(null, scope, view.cohort.cohortId)} observations={view.observations} />}</div>
    </section>
    <section aria-labelledby="decisionHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="decisionHeading" className="text-xl font-semibold">Are farmers continuing without being pushed?</h2>
      <p className="mt-2 leading-7">{gate ? (gate.atEnd ? "End of pilot" : "Week " + gate.gateWeek) + " check: " + gate.retainedVoluntarily + " of " + gate.onboarded + " farmers kept using MyFarm without a reminder. " + (gate.gateMet ? "That is at least half." : "That is less than half.") : "Week 8 has not ended, so only “continue” can be decided yet."}</p>
      <div className="mt-4"><ReviewForm key={"review" + search.at} submit={recordReviewAction.bind(null, scope, view.cohort.cohortId)} allowed={view.allowed} /></div>
      {view.reviews.length > 0 && <><h3 className="mt-6 text-lg font-semibold">Decisions so far</h3><ul aria-label="Decisions" className="mt-2 space-y-2">{view.reviews.map(row => <li key={row.reviewId} className="rounded-xl border border-border p-3">
        <p className="font-semibold"><time dateTime={row.reviewedOn}>{row.reviewedOn}</time> · {decisionLabels[row.decision]}</p>
        <p className="mt-1 text-sm">{row.gate ? "Recorded with " + row.gate.retainedVoluntarily + " of " + row.gate.onboarded + " continuing unprompted at " + (row.gate.atEnd ? "the end" : "week " + row.gate.gateWeek) + "." : "Recorded before week 8 was judged."}</p>
        <p className="mt-1 leading-7">{row.reason}</p>
      </li>)}</ul></>}
    </section>
  </section>;
}
