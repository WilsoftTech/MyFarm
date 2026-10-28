import Link from "next/link";
import { stockService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic="force-dynamic";

export default async function Inventory({params,searchParams}:{params:Promise<{farmId:string}>;searchParams:Promise<{cursor?:string}>}) {
 const {farmId}=await params,{cursor}=await searchParams;const farm=await loadPage(()=>productionService().farmContext(farmId));const page=await loadPage(()=>stockService().items(farmId,cursor?{cursor}:{}));const path="/farms/"+farmId+"/inventory";
 return <ProductionShell farm={farm} active="inventory" title="Inventory"><nav aria-label="Inventory actions" className="flex flex-wrap gap-5"><Link className="min-h-12 py-3 underline" href={path+"/new"}>Record stock movement</Link><Link className="min-h-12 py-3 underline" href={path+"/items/new"}>Add supply item</Link><Link className="min-h-12 py-3 underline" href={path+"/operations"}>Stock operations</Link></nav>
 <p>Balances include all recorded movements, including future-dated entries. Units are not converted. Inventory monetary value is unavailable.</p>
 {!page.items.length&&<p className="mt-5">No inventory items on this page. Record a harvest or poultry event, or add a supply item.</p>}
 <ul className="mt-5 space-y-5">{page.items.map(r=><li key={r.itemId} className="rounded-xl border p-5"><h2 className="text-xl font-semibold">{r.name}</h2><p>Unit: {r.unit}</p>{!r.balances.length?<p>No movements yet.</p>:<ul>{r.balances.map(b=><li key={b.locationId}>{b.locationName}: {b.quantity} {r.unit}</li>)}</ul>}</li>)}</ul><ProductionPagination path={path} cursor={cursor} nextCursor={page.nextCursor}/></ProductionShell>;
}
