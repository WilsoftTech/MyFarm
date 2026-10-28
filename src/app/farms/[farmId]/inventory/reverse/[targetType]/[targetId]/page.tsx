import { stockService, harvestService, poultryProductionService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
export const dynamic="force-dynamic";
import {notFound} from "next/navigation";
import {moreInventoryChoices,saveStockReversal} from "../../../../inventory-actions";
export default async function ReverseStock({params}:{params:Promise<{farmId:string;targetType:string;targetId:string}>}) {
 const {farmId,targetType,targetId}=await params;if(!["HARVEST","PRODUCTION","OPERATION"].includes(targetType))notFound();const farm=await loadPage(()=>productionService().farmContext(farmId));
 const r=targetType==="HARVEST"?await loadPage(()=>harvestService().detail(farmId,targetId)):targetType==="PRODUCTION"?await loadPage(()=>poultryProductionService().event(farmId,targetId)):await loadPage(()=>stockService().operation(farmId,targetId));
 return <ProductionShell farm={farm} active="inventory" title="Review stock reversal"><p className="mb-5">Original record: {r.quantity} {r.unit}, dated {"harvestDate"in r?r.harvestDate:r.occurredOn}. This appends opposite stock movements and reverses its linked sale, if any. Reverse payments first. Stock already used can prevent this correction.</p><RecordForm label="Confirm reversal" submit={saveStockReversal.bind(null,farmId,targetType,targetId)} load={moreInventoryChoices.bind(null,farmId)} fields={[{name:"occurredOn",label:"Reversal date",type:"date"},{name:"reason",label:"Reason for reversal"},{name:"confirmed",label:"I have reviewed this correction",type:"checkbox"}]}/></ProductionShell>;
}
