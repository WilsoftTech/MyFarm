import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { RecordForm } from "@/components/production/record-form";
import { activityCostChoices, activityPlotChoices, activityTypeChoices, moreActivityChoices, saveActivity } from "../actions";
export const dynamic = "force-dynamic";
export default async function NewActivity({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ for?: string; cursor?: string }> }) {
 const { farmId } = await params, { for: target, cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const path = "/farms/" + farmId + "/activities/new";
 if (!target) {
  const page = await loadPage(() => productionService().listEnterprises(farmId, cursor ? { cursor } : {}));
  return <ProductionShell farm={farm} active="activities" title="Schedule activity"><h2 className="text-xl font-semibold">What is this activity for?</h2>
  <ul className="mt-4 space-y-3"><li><Link className="inline-block min-h-12 py-3 underline" href={path + "?for=farm"}>The whole farm</Link></li>
  {page.items.map(r => <li key={r.enterpriseId}>{r.workflow && r.status === "ACTIVE" ? <Link className="inline-block min-h-12 py-3 underline" href={path + "?for=" + r.enterpriseId}>{r.name}</Link> : <p className="py-3">{r.name} — {r.status === "ACTIVE" ? "activities not available for this enterprise yet" : "closed"}</p>}</li>)}</ul>
  <ProductionPagination path={path} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
 }
 const enterpriseId = target === "farm" ? null : target;
 const enterprise = enterpriseId ? await loadPage(() => productionService().enterprise(farmId, enterpriseId)) : null;
 const [types, plots, costs] = await loadPage(() => Promise.all([activityTypeChoices(farmId, enterpriseId ?? undefined), activityPlotChoices(farmId), activityCostChoices(farmId)]));
 return <ProductionShell farm={farm} active="activities" title="Schedule activity"><p className="mb-4">For: <strong>{enterprise?.name ?? "The whole farm"}</strong>. <Link className="underline" href={path}>Change</Link></p>
 <div className="max-w-2xl rounded-xl border p-5"><RecordForm label="Save activity" submit={saveActivity.bind(null, farmId, enterpriseId)} load={moreActivityChoices.bind(null, farmId)} fields={[
 { name: "type", label: "Activity", choices: types, kind: "types" }, { name: "dueOn", label: "Due date", type: "date" }, { name: "plotId", label: "Plot", optional: true, choices: plots, kind: "plots" },
 { name: "workerName", label: "Worker name", optional: true }, { name: "notes", label: "Notes", optional: true }, { name: "costRecordId", label: "Cost from money records", optional: true, choices: costs, kind: "costs", hint: "Choose an expense or purchase you already recorded. This does not add a new cost." },
 ]} /></div></ProductionShell>;
}
