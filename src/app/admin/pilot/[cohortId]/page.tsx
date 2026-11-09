import Link from "next/link";
import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { CohortMeasures } from "@/components/pilot/cohort-measures";
import { IncidentForm, PaperConsentForm, PromptForm, ResolveForm } from "@/components/pilot/staff-forms";
import { categoryLabels, severityLabels } from "@/components/pilot/labels";
import { loadPage } from "@/app/farmer/guard";
import { openIncidentAction, recordPaperConsentAction, recordPromptAction, resolveIncidentAction } from "../actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pilot cohort" };

const saved: Record<string, string> = { cohort: "Cohort opened.", prompt: "Reminder logged.", incident: "Incident logged.", resolved: "Incident marked resolved.", consent: "Paper consent recorded." };

export default async function PilotCohortPage({ params, searchParams }: { params: Promise<{ cohortId: string }>; searchParams: Promise<{ scope?: string; saved?: string; at?: string }> }) {
  const [{ cohortId }, search] = await Promise.all([params, searchParams]);
  const scope = search.scope ?? "";
  const view = await loadPage(() => fieldPilotService().cohortView(scope, cohortId));
  const choices = view.participants.map(row => ({ participationId: row.participationId, pseudonym: row.pseudonym }));
  const missing = view.participants.filter(row => !row.paperConsent);
  return <section className="mx-auto max-w-4xl space-y-6">
    <div>
      <Link href={"/admin/pilot?scope=" + encodeURIComponent(scope)} className="text-sm underline underline-offset-4">All cohorts</Link>
      <h1 className="mt-2 text-3xl font-bold">{view.cohort.name}</h1>
      <p className="mt-2 leading-7">Code <strong>{view.cohort.code}</strong> · <time dateTime={view.cohort.startOn}>{view.cohort.startOn}</time> to <time dateTime={view.cohort.endOn}>{view.cohort.endOn}</time> · worked out <time dateTime={view.asOf}>{view.today}</time></p>
      {search.saved && saved[search.saved] && <p role="status" className="mt-3 rounded-xl bg-muted p-4">{saved[search.saved]}</p>}
      <Link href={"/admin/pilot/" + view.cohort.cohortId + "/evidence?scope=" + encodeURIComponent(scope)} className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-border px-5 font-semibold">Observations and decision</Link>
    </div>
    <CohortMeasures view={view} />
    <section aria-labelledby="promptHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="promptHeading" className="text-xl font-semibold">Reminders</h2>
      <div className="mt-3">{choices.length === 0 ? <p className="leading-7">No farmer has joined yet.</p> : <PromptForm key={"prompt" + search.at} submit={recordPromptAction.bind(null, scope, view.cohort.cohortId)} choices={choices} today={view.today} />}</div>
    </section>
    <section aria-labelledby="supportHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="supportHeading" className="text-xl font-semibold">Support incidents</h2>
      {view.incidents.length > 0 && <ul aria-label="Support incidents" className="mt-3 space-y-3">{view.incidents.map(row => <li key={row.incidentId} className="rounded-xl border border-border p-3">
        <p className="font-semibold">{categoryLabels[row.category]} · {severityLabels[row.severity]} · {row.status === "OPEN" ? "Open" : "Resolved " + row.resolvedOn}</p>
        <p className="mt-1 text-sm">{row.pseudonym ?? "Not about one farmer, or the farmer left the pilot"} · opened <time dateTime={row.openedOn}>{row.openedOn}</time></p>
        <p className="mt-1 leading-7">{row.summary}</p>
        {row.status === "OPEN" && <ResolveForm submit={resolveIncidentAction.bind(null, scope, view.cohort.cohortId, row.incidentId)} version={row.version} today={view.today} label={"Resolve incident opened " + row.openedOn} />}
      </li>)}</ul>}
      <div className="mt-4"><IncidentForm key={"incident" + search.at} submit={openIncidentAction.bind(null, scope, view.cohort.cohortId)} choices={choices} today={view.today} /></div>
    </section>
    <section aria-labelledby="consentHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="consentHeading" className="text-xl font-semibold">Paper consent</h2>
      {missing.length === 0 ? <p className="mt-2 leading-7">{view.participants.length === 0 ? "No farmer has joined yet." : "Every farmer in the pilot has a paper consent recorded."}</p>
        : <ul aria-label="Farmers without paper consent" className="mt-3 space-y-3">{missing.map(row => <li key={row.participationId} className="rounded-xl border border-border p-3">
          <p className="font-semibold">{row.pseudonym}</p>
          <PaperConsentForm submit={recordPaperConsentAction.bind(null, scope, view.cohort.cohortId, row.participationId)} version={row.version} label={"Paper consent for " + row.pseudonym} />
        </li>)}</ul>}
    </section>
  </section>;
}
