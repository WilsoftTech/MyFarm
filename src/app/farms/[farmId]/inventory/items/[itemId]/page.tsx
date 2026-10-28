import Link from "next/link";
import { reconstructionService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic="force-dynamic";
import {RecordForm} from "@/components/production/record-form";
import {refreshStockReconstruction,moreInventoryChoices} from "../../../inventory-actions";
export default async function StockItem({params,searchParams}:{params:Promise<{farmId:string;itemId:string}>;searchParams:Promise<{cursor?:string}>}) {
 const {farmId,itemId}=await params,{cursor}=await searchParams;const farm=await loadPage(()=>productionService().farmContext(farmId));const r=await loadPage(()=>reconstructionService().reconstruct(farmId,itemId,cursor?{cursor}:{}));const path="/farms/"+farmId+"/inventory/items/"+itemId;
 return <ProductionShell farm={farm} active="inventory" title={r.name+" stock"}><p role="status" className="rounded-xl bg-muted p-4">{r.matches?"Display matches movement history.":"Display comparison did not match. Showing balances rebuilt from movement history."}</p><p className="mt-4">Recomputed at {r.asOf}. Includes all recorded dates, including future entries. Unit: {r.unit}. Monetary valuation is unavailable.</p><dl className="my-5 grid gap-4 sm:grid-cols-2">{r.balances.map(b=><div key={b.locationId} className="rounded-xl border p-4"><dt>{b.locationName}</dt><dd className="text-xl font-semibold">{b.quantity} {r.unit}</dd></div>)}</dl>{!r.balances.length&&<p>No stock movements on this page.</p>}<ProductionPagination path={path} cursor={cursor} nextCursor={r.nextCursor}/><Link className="my-4 inline-block min-h-12 py-3 underline" href={path+"/history"}>View movement history</Link><RecordForm fields={[]} label="Recalculate stock" submit={refreshStockReconstruction.bind(null,farmId,itemId)} load={moreInventoryChoices.bind(null,farmId)}/></ProductionShell>;
}
