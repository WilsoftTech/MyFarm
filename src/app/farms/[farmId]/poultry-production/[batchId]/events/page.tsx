import Link from "next/link";
import {productionService} from "@/modules/enterprises-seasons/infrastructure/services";
import {poultryProductionService} from "@/modules/harvest-inventory/infrastructure/services";
import {loadPage} from "@/app/farmer/guard";
import {ProductionShell} from "@/components/production/shell";
import {ProductionPagination} from "@/components/production/pagination";
export const dynamic="force-dynamic";
export default async function Events({params,searchParams}:{params:Promise<{farmId:string;batchId:string}>;searchParams:Promise<{cursor?:string}>}){const {farmId,batchId}=await params,{cursor}=await searchParams;const farm=await loadPage(()=>productionService().farmContext(farmId));const page=await loadPage(()=>poultryProductionService().events(farmId,batchId,cursor?{cursor}:{}));const path="/farms/"+farmId+"/poultry-production/"+batchId;
return <ProductionShell farm={farm} active="poultry-batches" title="All production events"><Link className="inline-block min-h-12 py-3 underline" href={path}>Flock summary</Link>{!page.items.length&&<p>No events on this page.</p>}<ul className="space-y-4">{page.items.map(e=><li key={e.eventId} className="rounded-xl border p-4"><p>{e.type.replaceAll("_"," ")}: {e.quantity} {e.unit} on {e.occurredOn}</p>{e.note&&<p>{e.note}</p>}{e.reversed?<p>Reversed; original record preserved.</p>:<Link className="inline-block min-h-12 py-3 underline" href={"/farms/"+farmId+"/inventory/reverse/PRODUCTION/"+e.eventId}>Review reversal</Link>}</li>)}</ul><ProductionPagination path={path+"/events"} cursor={cursor} nextCursor={page.nextCursor}/></ProductionShell>;
}
