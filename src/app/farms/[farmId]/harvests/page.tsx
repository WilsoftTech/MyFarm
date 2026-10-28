import Link from "next/link";
import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic = "force-dynamic";
export default async function Harvests({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string }> }) {
 const { farmId } = await params, { cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const page = await loadPage(() => harvestService().list(farmId, cursor ? { cursor } : {}));
 const path = "/farms/" + farmId + "/harvests";
 return <ProductionShell farm={farm} active="harvests" title="Harvests"><Link className="inline-block min-h-12 py-3 underline" href={path + "/new"}>Record harvest</Link>
 <p>Gross harvest and initial losses are recorded separately. Later stock use is in inventory history.</p>
 {page.items.length === 0 ? <p className="mt-6">No harvests recorded on this page.</p> : <ul className="mt-6 space-y-4">{page.items.map(r => <li key={r.harvestId} className="rounded-xl border p-4"><Link className="underline" href={path + "/" + r.harvestId}>{r.cropName} - {r.harvestDate}</Link><p>{r.quantity} kg harvested; {r.lossQuantity} kg initial loss; {r.storedQuantity} kg initially stored.</p></li>)}</ul>}
 <ProductionPagination path={path} cursor={cursor} nextCursor={page.nextCursor} /></ProductionShell>;
}
