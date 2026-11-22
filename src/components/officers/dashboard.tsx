import type { DashboardView } from "@/modules/extension-officers/contracts/service";
import { OfficerOfflineSetup } from "./offline-setup";
import { Button } from "../ui/button";

export function OfficerDashboard({ view, scope }: { view: DashboardView; scope: string }) {
  const { dashboard, farms } = view;
  const cards = [
    ["My farmers", dashboard.counts?.myFarmers], ["Visits today", dashboard.counts?.visitsToday],
    ["Follow-ups", dashboard.counts?.followUps], ["Problems", dashboard.counts?.problems],
  ] as const;
  return <div className="mt-6 space-y-6">
    <OfficerOfflineSetup accountId={view.officerAccountId} scope={scope} farms={farms} asOf={dashboard.asOf} /><a className="inline-block min-h-12 py-3 underline" href={`/agent/registration?scope=${scope}`}>Prepare farmer registration</a><p className="text-sm leading-6">Checked at <time dateTime={dashboard.asOf}>{dashboard.asOf}</time>. Today: {dashboard.today} (Uganda). Connect and reload to check current access and counts.</p>
    {dashboard.coverage === "PARTIAL" && <p role="status">Totals are unavailable because some records could not be included. The list below is a limited page.</p>}
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Assigned work counts">{cards.map(([label, count]) => <div key={label} className="rounded-xl border border-border p-4"><dt className="text-sm">{label}</dt><dd className="mt-2 text-2xl font-semibold">{count ?? "Unavailable"}</dd></div>)}</dl>
    <p className="text-sm leading-6">Visits today includes planned and completed visits, excluding cancelled visits. Follow-ups includes open items due today or overdue. Problems includes explicitly flagged, unresolved visit issues.</p>
    <section aria-labelledby="assigned-farms"><h2 id="assigned-farms" className="text-xl font-semibold">Assigned farms</h2>
      {farms.length === 0 ? <p className="mt-3">No farms are currently assigned to you. Ask the farmer to grant access from their farm’s officer page.</p> : <ul className="mt-3 space-y-3">{farms.map(farm => <li key={farm.assignmentId} className="rounded-xl border border-border p-4"><h3 className="break-words font-semibold">{farm.name}</h3><p>{farm.district}</p><p className="mt-2 text-sm">Access: {farm.permissions.map(value => ({ DASHBOARD: "Dashboard", VISITS: "Visits", FOLLOW_UPS: "Follow-ups" })[value]).join(", ")}</p>{farm.permissions.includes("VISITS") && <a className="inline-block min-h-12 py-3 underline" href={`/agent/work?scope=${scope}&farmId=${farm.farmId}&assignmentId=${farm.assignmentId}`}>Open visits and follow-ups</a>}</li>)}</ul>}
      {view.nextCursor && <Button asChild variant="outline" className="mt-4"><a href={`/agent?scope=${encodeURIComponent(scope)}&cursor=${view.nextCursor}`}>More assigned farms</a></Button>}
    </section>
    <Button asChild variant="outline"><a href={`/agent?scope=${encodeURIComponent(scope)}`}>Reload assigned work</a></Button>
    <details className="rounded-xl border border-border p-4"><summary className="cursor-pointer font-semibold">Share my officer account ID</summary><p className="mt-3 text-sm leading-6">Share this ID directly with a farmer who wants to grant you access. They choose whether to grant access.</p><p className="mt-2 break-all font-mono text-sm">{view.officerAccountId}</p></details>
  </div>;
}
