import Link from "next/link";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic = "force-dynamic";
export default async function Activities({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string }> }) {
 const { farmId } = await params, { cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const page = await loadPage(() => activityService().list(farmId, cursor ? { cursor } : {}));
 const path = "/farms/" + farmId + "/activities";
 return <ProductionShell farm={farm} active="activities" title="Activities"><Link className="inline-block min-h-12 py-3 underline" href={path + "/new"}>Schedule activity</Link>
 {page.items.length === 0 ? <p className="mt-6">No activities on this page.</p> : <ul className="mt-6 space-y-4">{page.items.map(r => <li key={r.activityId} className="rounded-xl border p-4"><Link className="underline" href={path + "/" + r.activityId}>{r.typeLabel}</Link><p>Due {r.dueOn}{r.enterpriseName ? " · " + r.enterpriseName : ""}{r.plotName ? " · " + r.plotName : ""}</p></li>)}</ul>}
 <ProductionPagination path={path} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
}
