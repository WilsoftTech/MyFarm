import Link from "next/link";
import { stockService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
export const dynamic="force-dynamic";

export default async function Operations({params,searchParams}:{params:Promise<{farmId:string}>;searchParams:Promise<{cursor?:string}>}) {const {farmId}=await params,{cursor}=await searchParams;const farm=await loadPage(()=>productionService().farmContext(farmId));const p=await loadPage(()=>stockService().operations(farmId,cursor?{cursor}:{}));const path="/farms/"+farmId+"/inventory";
 return <ProductionShell farm={farm} active="inventory" title="Stock operations">{!p.items.length&&<p>No stock operations on this page. Harvest and poultry records keep their own source history.</p>}<ul className="space-y-5">{p.items.map(r=><li key={r.operationId} className="rounded-xl border p-5"><p>{r.type}: {r.quantity} {r.unit} on {r.occurredOn}</p><p>{r.reason}</p>{r.accountingRecordId&&<Link className="inline-block min-h-12 py-3 underline" href={"/farms/"+farmId+"/accounting/records/"+r.accountingRecordId}>Open sale</Link>}{r.type!=="REVERSE"&&<Link className="ml-5 inline-block min-h-12 py-3 underline" href={path+"/reverse/OPERATION/"+r.operationId}>Review reversal</Link>}</li>)}</ul><ProductionPagination path={path+"/operations"} cursor={cursor} nextCursor={p.nextCursor}/></ProductionShell>;
}
