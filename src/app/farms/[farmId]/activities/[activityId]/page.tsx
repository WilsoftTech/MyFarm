import Link from "next/link";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
import { ActivityCancelForm } from "@/components/production/activity-cancel-form";
import { activityBucketLabels, activityTime } from "@/components/production/activity-labels";
import { activityCostChoices, moreActivityChoices, saveActivityCancellation, saveActivityCompletion } from "../actions";
export const dynamic = "force-dynamic";
export default async function Activity({ params }: { params: Promise<{ farmId: string; activityId: string }> }) {
 const { farmId, activityId } = await params;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const r = await loadPage(() => activityService().detail(farmId, activityId));
 const costs = r.status === "SCHEDULED" ? await loadPage(() => activityCostChoices(farmId)) : null;
 const rows: [string, string][] = [["Status", activityBucketLabels[r.state]], ["Due date", r.dueOn], ["For", r.enterpriseName ?? "The whole farm"], ["Plot", r.plotName ?? "Not recorded"], ["Worker", r.workerName ?? "Not recorded"]];
 if (r.notes) rows.push(["Notes", r.notes]);
 if (r.completedAt) rows.push(["Completed", activityTime(r.completedAt)]);
 if (r.cancelledAt) rows.push(["Cancelled", activityTime(r.cancelledAt)]);
 if (r.cancelReason) rows.push(["Why it was cancelled", r.cancelReason]);
 return <ProductionShell farm={farm} active="activities" title={r.typeLabel}><dl className="grid gap-5 rounded-xl border p-5 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-sm">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>)}</dl>
 {r.cost && <section aria-labelledby="costHeading" className="mt-6 rounded-xl border p-5"><h2 id="costHeading" className="text-xl font-semibold">Cost</h2><p className="mt-2 font-semibold">{r.cost.amount} {r.cost.currency} · {r.cost.categoryName}</p>
 {r.cost.reversed && <p role="status" className="mt-2 font-semibold">This cost was reversed in accounting.</p>}<p className="mt-2">This is shown from your money records and is only counted there.</p><Link className="inline-block min-h-12 py-3 underline" href={"/farms/" + farmId + "/accounting/records/" + r.cost.recordId}>Open money record</Link></section>}
 {costs && <><section aria-labelledby="completeHeading" className="mt-6 max-w-2xl rounded-xl border p-5"><h2 id="completeHeading" className="mb-4 text-xl font-semibold">Mark as done</h2><p className="mb-4">You are recorded as the person who marked it done, with the current time. Leave a field blank to keep what was scheduled.</p>
 <RecordForm label="Mark as done" submit={saveActivityCompletion.bind(null, farmId, activityId, r.version)} load={moreActivityChoices.bind(null, farmId)} fields={[
 { name: "workerName", label: "Worker name", optional: true }, { name: "notes", label: "Notes", optional: true }, { name: "costRecordId", label: "Cost from money records", optional: true, choices: costs, kind: "costs", hint: "Choose an expense or purchase you already recorded. This does not add a new cost." },
 ]} /></section>
 <ActivityCancelForm version={r.version} submit={saveActivityCancellation.bind(null, farmId, activityId)} /></>}
 <Link className="mt-5 inline-block min-h-12 py-3 underline" href={"/farms/" + farmId + "/activities"}>Back to activities</Link></ProductionShell>;
}
