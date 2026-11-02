import Link from "next/link";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
export const dynamic = "force-dynamic";
export default async function Activity({ params }: { params: Promise<{ farmId: string; activityId: string }> }) {
 const { farmId, activityId } = await params;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const r = await loadPage(() => activityService().detail(farmId, activityId));
 return <ProductionShell farm={farm} active="activities" title={r.typeLabel}><dl className="grid gap-5 rounded-xl border p-5 sm:grid-cols-2">{[
 ["Due date", r.dueOn], ["For", r.enterpriseName ?? "The whole farm"], ["Plot", r.plotName ?? "Not recorded"],
 ].map(([k, v]) => <div key={k}><dt className="text-sm">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>)}</dl><Link className="mt-5 inline-block min-h-12 py-3 underline" href={"/farms/" + farmId + "/activities"}>Back to activities</Link></ProductionShell>;
}
