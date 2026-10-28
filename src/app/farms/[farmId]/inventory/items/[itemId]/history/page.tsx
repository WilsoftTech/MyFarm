import Link from "next/link";
import { reconstructionService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic="force-dynamic";

export default async function StockHistory({params,searchParams}:{params:Promise<{farmId:string;itemId:string}>;searchParams:Promise<{cursor?:string}>}) {
 const {farmId,itemId}=await params,{cursor}=await searchParams;const farm=await loadPage(()=>productionService().farmContext(farmId));const page=await loadPage(()=>reconstructionService().history(farmId,itemId,cursor?{cursor}:{}));const path="/farms/"+farmId+"/inventory/items/"+itemId;
 return <ProductionShell farm={farm} active="inventory" title="Stock movement history"><Link className="inline-block min-h-12 py-3 underline" href={path}>Reconstructed stock</Link><p>Newest recorded movements first. Corrections append entries; original history is preserved.</p>{!page.items.length&&<p className="mt-5">No movements on this page.</p>}<ol className="mt-5 space-y-4">{page.items.map(m=><li key={m.movementId} className="rounded-xl border p-4"><p className="font-semibold">{m.reason.replaceAll("_"," ").toLowerCase()}: {m.quantityDelta} {m.unit}</p><p>{m.locationName}; effective date {m.occurredOn}</p><p className="break-words text-sm">Recorded {m.createdAt}</p></li>)}</ol><ProductionPagination path={path+"/history"} cursor={cursor} nextCursor={page.nextCursor}/></ProductionShell>;
}
