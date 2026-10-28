import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { poultryProductionService } from "@/modules/harvest-inventory/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
export const dynamic="force-dynamic";
export default async function Flock({params}:{params:Promise<{farmId:string;batchId:string}>}) {
 const {farmId,batchId}=await params;const farm=await loadPage(()=>productionService().farmContext(farmId));const s=await loadPage(()=>poultryProductionService().summary(farmId,batchId));
 return <ProductionShell farm={farm} active="poultry-batches" title="Poultry production"><p className="text-2xl font-semibold">Current birds: {s.currentQuantity}</p><p>Opening birds: {s.startingQuantity}. Reconstructed as of {s.asOf}.</p><Link className="inline-block min-h-12 py-3 underline" href={"/farms/"+farmId+"/poultry-production/new"}>Record poultry event</Link>
 <ul className="space-y-4">{s.events.map(e=><li key={e.eventId} className="rounded-xl border p-4"><p>{e.type.replaceAll("_"," ")}: {e.quantity} {e.unit} on {e.occurredOn}</p>{e.note&&<p>{e.note}</p>}{e.accountingRecordId&&<Link className="underline" href={"/farms/"+farmId+"/accounting/records/"+e.accountingRecordId}>Open sale record</Link>}<Link className="ml-5 inline-block min-h-12 py-3 underline" href={"/farms/"+farmId+"/inventory/reverse/PRODUCTION/"+e.eventId}>Review reversal</Link></li>)}</ul>{s.historyTruncated&&<p>Showing the latest 100 events. Current birds include all movements.</p>}</ProductionShell>;
}
