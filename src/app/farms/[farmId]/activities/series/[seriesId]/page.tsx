import Link from "next/link";
import { activityService, recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
import { ActivityConfirmForm } from "@/components/production/activity-confirm-form";
import { recurrenceFrequencyChoices, recurrencePattern } from "@/components/production/activity-labels";
import { moreActivityChoices, saveSeriesChange, saveSeriesStop } from "../../actions";
export const dynamic = "force-dynamic";
export default async function ActivitySeries({ params }: { params: Promise<{ farmId: string; seriesId: string }> }) {
 const { farmId, seriesId } = await params;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 await loadPage(() => recurrenceService().expand(farmId));
 const r = await loadPage(() => recurrenceService().detail(farmId, seriesId));
 const next = await loadPage(() => activityService().list(farmId, { recurrenceId: seriesId, bucket: "UPCOMING", limit: 5 }));
 const path = "/farms/" + farmId + "/activities";
 const rows: [string, string][] = [["Repeats", recurrencePattern(r.frequency, r.interval)], ["First due date", r.startOn], ["Last due date", r.endOn ?? "No end date"], ["For", r.enterpriseName ?? "The whole farm"], ["Plot", r.plotName ?? "Not recorded"], ["Worker", r.workerName ?? "Not recorded"]];
 if (r.stoppedFrom) rows.push(["Stopped from", r.stoppedFrom]);
 return <ProductionShell farm={farm} active="activities" title={"Repeating " + r.typeLabel.toLowerCase()}><dl className="grid gap-5 rounded-xl border p-5 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-sm">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>)}</dl>
 {r.previousId && <Link className="mt-3 inline-block min-h-12 py-3 underline" href={path + "/series/" + r.previousId}>Open the earlier pattern</Link>}
 <section aria-labelledby="nextHeading" className="mt-6"><h2 id="nextHeading" className="text-xl font-semibold">Coming up</h2>{next.items.length === 0 ? <p className="mt-2">Nothing is scheduled ahead from this pattern.</p> : <ul className="mt-2 space-y-2">{next.items.map(row => <li key={row.activityId}><Link className="inline-block min-h-12 py-3 underline" href={path + "/" + row.activityId}>{row.dueOn}</Link></li>)}</ul>}<p className="mt-2">To skip one date, open it and cancel it. It will not come back.</p></section>
 {!r.stoppedFrom && <><section aria-labelledby="changeHeading" className="mt-6 max-w-2xl rounded-xl border p-5"><h2 id="changeHeading" className="mb-4 text-xl font-semibold">Change from a date</h2><p className="mb-4">Activities before this date stay as they are. Dates you already skipped stay skipped.</p>
 <RecordForm label="Save change" submit={saveSeriesChange.bind(null, farmId, seriesId, r.version)} load={moreActivityChoices.bind(null, farmId)} fields={[
 { name: "effectiveFrom", label: "Change from", type: "date" }, { name: "interval", label: "Repeat every", type: "number", step: "1", min: "1", defaultValue: String(r.interval) }, { name: "frequency", label: "Period", defaultValue: r.frequency, choices: { items: recurrenceFrequencyChoices, nextCursor: null }, kind: "frequency" },
 { name: "endOn", label: "Last due date", type: "date", optional: true }, { name: "workerName", label: "Worker name", optional: true, defaultValue: r.workerName ?? "" }, { name: "notes", label: "Notes", optional: true, defaultValue: r.notes ?? "" },
 ]} /></section>
 <ActivityConfirmForm title="Stop repeating" body="Activities from this date onward are cancelled and no more are added. Earlier and completed activities stay in your history." confirm="I want to stop this repeating activity." pending="Stopping…" version={r.version} field={{ name: "stopFrom", label: "Stop from", type: "date" }} submit={saveSeriesStop.bind(null, farmId, seriesId, r.version)} /></>}
 <Link className="mt-5 inline-block min-h-12 py-3 underline" href={path + "/series"}>Back to repeating activities</Link></ProductionShell>;
}
