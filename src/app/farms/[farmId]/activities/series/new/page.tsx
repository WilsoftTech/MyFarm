import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { RecordForm } from "@/components/production/record-form";
import { recurrenceFrequencyChoices } from "@/components/production/activity-labels";
import { activityPlotChoices, moreActivityChoices, recurringTypeChoices, saveSeries } from "../../actions";
export const dynamic = "force-dynamic";
export default async function NewActivitySeries({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ for?: string; cursor?: string }> }) {
 const { farmId } = await params, { for: target, cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const path = "/farms/" + farmId + "/activities/series/new";
 if (!target) {
  const page = await loadPage(() => productionService().listEnterprises(farmId, cursor ? { cursor } : {}));
  return <ProductionShell farm={farm} active="activities" title="Start repeating activity"><h2 className="text-xl font-semibold">What is this activity for?</h2>
  <ul className="mt-4 space-y-3"><li><Link className="inline-block min-h-12 py-3 underline" href={path + "?for=farm"}>The whole farm</Link></li>
  {page.items.map(r => <li key={r.enterpriseId}>{r.workflow && r.status === "ACTIVE" ? <Link className="inline-block min-h-12 py-3 underline" href={path + "?for=" + r.enterpriseId}>{r.name}</Link> : <p className="py-3">{r.name} — {r.status === "ACTIVE" ? "activities not available for this enterprise yet" : "closed"}</p>}</li>)}</ul>
  <ProductionPagination path={path} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
 }
 const enterpriseId = target === "farm" ? null : target;
 const enterprise = enterpriseId ? await loadPage(() => productionService().enterprise(farmId, enterpriseId)) : null;
 const [types, plots] = await loadPage(() => Promise.all([recurringTypeChoices(farmId, enterpriseId ?? undefined), activityPlotChoices(farmId)]));
 return <ProductionShell farm={farm} active="activities" title="Start repeating activity"><p className="mb-4">For: <strong>{enterprise?.name ?? "The whole farm"}</strong>. <Link className="underline" href={path}>Change</Link></p>
 <p className="mb-4">The next 30 days are added to your activities, one for each due date. Each one is then done, skipped or missed on its own.</p>
 <div className="max-w-2xl rounded-xl border p-5"><RecordForm label="Start repeating" submit={saveSeries.bind(null, farmId, enterpriseId)} load={moreActivityChoices.bind(null, farmId)} fields={[
 { name: "type", label: "Activity", choices: types, kind: "types" }, { name: "interval", label: "Repeat every", type: "number", step: "1", min: "1", defaultValue: "1" }, { name: "frequency", label: "Period", choices: { items: recurrenceFrequencyChoices, nextCursor: null }, kind: "frequency" },
 { name: "startOn", label: "First due date", type: "date" }, { name: "endOn", label: "Last due date", type: "date", optional: true }, { name: "plotId", label: "Plot", optional: true, choices: plots, kind: "plots" }, { name: "workerName", label: "Worker name", optional: true }, { name: "notes", label: "Notes", optional: true },
 ]} /></div></ProductionShell>;
}
