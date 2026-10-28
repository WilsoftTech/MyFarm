import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
export const dynamic="force-dynamic";
import {inventoryChoices,moreInventoryChoices,saveStockOperation} from "../../inventory-actions";
export default async function StockEntry({params}:{params:Promise<{farmId:string}>}) {
 const {farmId}=await params;const farm=await loadPage(()=>productionService().farmContext(farmId));const [items,stores,categories]=await loadPage(()=>Promise.all([inventoryChoices(farmId,"items"),inventoryChoices(farmId,"locations"),inventoryChoices(farmId,"revenue-categories")]));
 return <ProductionShell farm={farm} active="inventory" title="Record stock movement"><p className="mb-5">A sale creates both a stock movement and a money record. Use poultry events for bird sales or deaths. Transfers need a destination store; adjustments need a direction and an owner review. Give a reason for every movement. Fill money fields only for sales.</p><div className="max-w-2xl"><RecordForm label="Save stock movement" submit={saveStockOperation.bind(null,farmId)} load={moreInventoryChoices.bind(null,farmId)} fields={[
 {name:"itemId",label:"Inventory item",choices:items,kind:"items",autoUnit:true},{name:"unit",label:"Unit",readOnly:true}, {name:"locationId",label:"From store",choices:stores,kind:"locations"},
 {name:"type",label:"Operation",choices:{items:[{id:"SALE",label:"Sale"},{id:"LOSS",label:"Loss or damage"},{id:"TRANSFER",label:"Transfer"},{id:"ADJUSTMENT",label:"Adjustment (owner review)"}],nextCursor:null}},
 {name:"quantity",label:"Quantity",type:"number",step:"0.000001",min:"0.000001"},{name:"occurredOn",label:"Movement date",type:"date"},{name:"reason",label:"Reason"},
 {name:"destinationLocationId",label:"Destination store",optional:true,choices:stores,kind:"locations"},{name:"direction",label:"Adjustment direction",optional:true,choices:{items:[{id:"IN",label:"Add stock"},{id:"OUT",label:"Remove stock"}],nextCursor:null}},
 {name:"categoryId",label:"Sale category",optional:true,choices:categories,kind:"revenue-categories"},{name:"amount",label:"Sale amount",optional:true,type:"number",step:"0.0001",min:"0.0001"},{name:"currency",label:"Sale currency",optional:true}
 ]}/></div></ProductionShell>;
}
