import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { RegistryNav } from "@/components/farmer-registry/registry-nav";
import { ConsentPoints, JoinPilotForm, LeavePilotForm } from "@/components/pilot/pilot-forms";
import { loadPage } from "@/app/farmer/guard";
import { joinPilotAction, leavePilotAction } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "MyFarm pilot" };

/** A farmer's own pilot page (D-P09-006, D-P09-009). It shows only their own participation. */
export default async function PilotPage({ searchParams }: { searchParams: Promise<{ joined?: string; left?: string }> }) {
  const [participations, search] = await Promise.all([loadPage(() => fieldPilotService().myParticipations()), searchParams]);
  const current = participations.find(row => row.status === "ENROLLED");
  const left = participations.filter(row => row.status === "WITHDRAWN");
  return <section className="mx-auto max-w-xl">
    <RegistryNav />
    <p className="text-sm text-primary">MyFarm pilot</p>
    <h1 className="mt-2 text-3xl font-bold">{current ? "You are in the pilot" : "Join the MyFarm pilot"}</h1>
    {search.joined === "1" && current && <p role="status" className="mt-4 rounded-xl bg-muted p-4">You joined the pilot. Thank you.</p>}
    {search.left === "1" && !current && <p role="status" className="mt-4 rounded-xl bg-muted p-4">You left the pilot. Nothing more is counted about you.</p>}
    {current ? <div className="mt-6 space-y-6">
      <dl className="grid gap-4 rounded-2xl border border-border bg-white p-6">
        <div><dt className="text-sm text-foreground/70">Pilot</dt><dd className="font-semibold">{current.cohortName}</dd></div>
        <div><dt className="text-sm text-foreground/70">Your code name</dt><dd className="font-semibold">{current.pseudonym}</dd></div>
        <div><dt className="text-sm text-foreground/70">Joined</dt><dd className="font-semibold"><time dateTime={current.enrolledOn}>{current.enrolledOn}</time></dd></div>
      </dl>
      <section aria-labelledby="agreedHeading" className="rounded-2xl border border-border bg-white p-6"><h2 id="agreedHeading" className="text-lg font-semibold">What you agreed to</h2><div className="mt-3"><ConsentPoints /></div></section>
      <section aria-labelledby="leaveHeading" className="rounded-2xl border border-border bg-white p-6"><h2 id="leaveHeading" className="text-lg font-semibold">Leave the pilot</h2><div className="mt-3"><LeavePilotForm submit={leavePilotAction.bind(null, current.participationId)} version={current.version} /></div></section>
    </div> : <div className="mt-6 space-y-6">
      <p className="leading-7">The MyFarm team is checking whether MyFarm is useful to farmers. If they gave you a pilot code, you can join here. Joining is your choice.</p>
      {left.length > 0 && <p className="rounded-xl bg-muted p-4 leading-7">You left {left.map(row => row.cohortName).join(", ")}. You can join a different pilot with a new code.</p>}
      <div className="rounded-2xl border border-border bg-white p-6"><JoinPilotForm submit={joinPilotAction} /></div>
    </div>}
  </section>;
}
