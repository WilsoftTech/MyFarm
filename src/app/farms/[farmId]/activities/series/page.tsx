import Link from "next/link";
import { recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { recurrencePattern } from "@/components/production/activity-labels";
export const dynamic = "force-dynamic";
export default async function ActivitySeriesList({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string }> }) {
 const { farmId } = await params, { cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const page = await loadPage(() => recurrenceService().list(farmId, cursor ? { cursor } : {}));
 const path = "/farms/" + farmId + "/activities/series";
 return <ProductionShell farm={farm} active="activities" title="Repeating activities"><Link className="inline-block min-h-12 py-3 underline" href={path + "/new"}>Start repeating activity</Link>
 {page.items.length === 0 ? <p className="mt-6">No repeating activities on this page.</p> : <ul className="mt-6 space-y-4">{page.items.map(r => <li key={r.recurrenceId} className="rounded-xl border p-4"><Link className="underline" href={path + "/" + r.recurrenceId}>{r.typeLabel}</Link><p>{recurrencePattern(r.frequency, r.interval)}{r.enterpriseName ? " · " + r.enterpriseName : ""}{r.plotName ? " · " + r.plotName : ""}</p><p>{r.stoppedFrom ? "Stopped from " + r.stoppedFrom : "Started " + r.startOn}</p></li>)}</ul>}
 <ProductionPagination path={path} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
}
