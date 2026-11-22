import Link from "next/link";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { GrantOfficerForm, RevokeOfficerForm } from "@/components/officers/assignment-form";
import { grantOfficerAction, revokeOfficerAction } from "@/app/agent/actions";
export const dynamic = "force-dynamic";
export default async function Page({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ updated?: string; cursor?: string }> }) {
  const { farmId } = await params;
  const query = await searchParams;
  const result = await loadPage(() => officerServices().assignments.list(farmId, query.cursor ?? null));
  return <section className="space-y-6"><Link href={`/farms/${farmId}`} className="underline">Back to farm</Link><h1 className="text-3xl font-bold">Farm officer access</h1>
    {query.updated === "1" && <p role="status">Officer access updated.</p>}
    <GrantOfficerForm submit={grantOfficerAction.bind(null, farmId)} />
    <h2 className="text-xl font-semibold">Assignments</h2>
    {result.items.length === 0 && <p>No officer assignments have been recorded.</p>}
    {result.truncated && <p role="status">Showing 100 assignments on this page.</p>}
    <ul className="space-y-4">{result.items.map(row => <li key={row.assignmentId} className="rounded-xl border border-border p-4"><p className="break-all font-semibold">{row.officerId}</p><p>Granted {row.grantedAt}</p><p>{row.revokedAt ? "Access removed" : "Access granted"}</p>{!row.revokedAt && <RevokeOfficerForm row={row} submit={revokeOfficerAction.bind(null, farmId)} />}</li>)}</ul>
    {result.nextCursor && <Link href={`/farms/${farmId}/officers?cursor=${result.nextCursor}`} className="inline-block rounded-xl border border-border px-5 py-3">More assignments</Link>}
  </section>;
}
