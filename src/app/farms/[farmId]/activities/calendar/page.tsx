import Link from "next/link";
import { activityService, recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { adjacentMonth, farmToday } from "@/modules/farm-activities/domain/activity";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { activityBucketLabels } from "@/components/production/activity-labels";
export const dynamic = "force-dynamic";
export default async function ActivityCalendar({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ month?: string; cursor?: string }> }) {
 const { farmId } = await params, { month = farmToday(new Date()).slice(0, 7), cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 await loadPage(() => recurrenceService().expand(farmId));
 const page = await loadPage(() => activityService().list(farmId, { month, limit: 50, ...(cursor ? { cursor } : {}) }));
 const path = "/farms/" + farmId + "/activities", calendar = path + "/calendar?month=";
 const days = new Map<string, typeof page.items>();
 for (const row of page.items) days.set(row.dueOn, [...(days.get(row.dueOn) ?? []), row]);
 return <ProductionShell farm={farm} active="activities" title={"Calendar " + month}>
 <nav aria-label="Calendar months" className="flex flex-wrap gap-x-6"><Link className="inline-flex min-h-12 items-center underline" href={calendar + adjacentMonth(month, -1)}>Previous month</Link><Link className="inline-flex min-h-12 items-center underline" href={calendar + adjacentMonth(month, 1)}>Next month</Link><Link className="inline-flex min-h-12 items-center underline" href={path}>Activity lists</Link></nav>
 {days.size === 0 ? <p className="mt-6">Nothing on this page of the month.</p> : <div className="mt-6 space-y-6">{[...days].map(([day, rows]) => <section key={day} aria-labelledby={"day" + day}><h2 id={"day" + day} className="text-xl font-semibold">{day}</h2><ul className="mt-2 space-y-3">{rows.map(r => <li key={r.activityId} className="rounded-xl border p-4"><Link className="underline" href={path + "/" + r.activityId}>{r.typeLabel}</Link><p>{activityBucketLabels[r.state]}{r.enterpriseName ? " · " + r.enterpriseName : ""}{r.plotName ? " · " + r.plotName : ""}</p></li>)}</ul></section>)}</div>}
 <ProductionPagination path={calendar + month} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
}
