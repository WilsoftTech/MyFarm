import Link from "next/link";
import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { CohortForm } from "@/components/pilot/staff-forms";
import { loadPage } from "@/app/farmer/guard";
import { createCohortAction } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pilot cohorts" };

/** Staff only: ADMIN of the organization in ?scope= (D-P09-007). */
export default async function PilotCohortsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const scope = (await searchParams).scope ?? "";
  const cohorts = await loadPage(() => fieldPilotService().cohorts(scope));
  return <section className="mx-auto max-w-3xl space-y-6">
    <div><p className="text-sm text-primary">Field pilot</p><h1 className="mt-2 text-3xl font-bold">Pilot cohorts</h1>
      <p className="mt-3 leading-7">Farmers join a cohort themselves with its code, after reading what joining means. You see code names and counts, never names, phone numbers, money or records.</p></div>
    <section aria-labelledby="cohortsHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="cohortsHeading" className="text-xl font-semibold">Cohorts</h2>
      {cohorts.length === 0 ? <p className="mt-2 leading-7">No cohort yet.</p> : <ul aria-label="Cohorts" className="mt-3 space-y-2">{cohorts.map(row => <li key={row.cohortId} className="rounded-xl border border-border p-3">
        <Link href={"/admin/pilot/" + row.cohortId + "?scope=" + encodeURIComponent(scope)} className="font-semibold underline underline-offset-4">{row.name}</Link>
        <p className="mt-1 text-sm">Code {row.code} · <time dateTime={row.startOn}>{row.startOn}</time> to <time dateTime={row.endOn}>{row.endOn}</time> · {row.joined} {row.joined === 1 ? "farmer" : "farmers"}</p>
      </li>)}</ul>}
    </section>
    <section aria-labelledby="newCohortHeading" className="rounded-2xl border border-border bg-white p-5">
      <h2 id="newCohortHeading" className="text-xl font-semibold">Open a cohort</h2>
      <p className="mt-1 text-sm leading-6 text-foreground/75">Do not enrol real farmers until the pilot-start checklist is complete.</p>
      <div className="mt-4"><CohortForm submit={createCohortAction.bind(null, scope)} /></div>
    </section>
  </section>;
}
