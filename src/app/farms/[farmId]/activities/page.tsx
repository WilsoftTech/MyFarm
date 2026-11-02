import Link from "next/link";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { ACTIVITY_BUCKETS, type ActivityBucket } from "@/modules/farm-activities/domain/activity";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { activityBucketLabels, activityEmptyLabels } from "@/components/production/activity-labels";
export const dynamic = "force-dynamic";
export default async function Activities({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ bucket?: string; cursor?: string }> }) {
 const { farmId } = await params, { bucket = "TODAY", cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const page = await loadPage(() => activityService().list(farmId, { bucket, ...(cursor ? { cursor } : {}) }));
 const path = "/farms/" + farmId + "/activities";
 return <ProductionShell farm={farm} active="activities" title="Activities"><Link className="inline-block min-h-12 py-3 underline" href={path + "/new"}>Schedule activity</Link>
 <nav aria-label="Activity lists" className="mt-2 flex flex-wrap gap-x-6 gap-y-2">{ACTIVITY_BUCKETS.map(value => <Link key={value} aria-current={value === bucket ? "page" : undefined} className={"inline-flex min-h-12 items-center underline underline-offset-4" + (value === bucket ? " font-bold" : "")} href={path + "?bucket=" + value}>{activityBucketLabels[value]}</Link>)}</nav>
 {page.items.length === 0 ? <p className="mt-6">{activityEmptyLabels[bucket as ActivityBucket]}</p> : <ul className="mt-6 space-y-4">{page.items.map(r => <li key={r.activityId} className="rounded-xl border p-4"><Link className="underline" href={path + "/" + r.activityId}>{r.typeLabel}</Link><p>Due {r.dueOn}{r.enterpriseName ? " · " + r.enterpriseName : ""}{r.plotName ? " · " + r.plotName : ""}</p>{r.workerName && <p>Worker: {r.workerName}</p>}</li>)}</ul>}
 <ProductionPagination path={path + "?bucket=" + bucket} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
}
