import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
import { inventoryChoices, moreInventoryChoices, savePoultryEvent } from "../../inventory-actions";
export const dynamic="force-dynamic";
export default async function PoultryEvent({params}:{params:Promise<{farmId:string}>}) {
 const {farmId}=await params; const farm=await loadPage(()=>productionService().farmContext(farmId));
 const [batches,locations,categories]=await loadPage(()=>Promise.all([inventoryChoices(farmId,"batches"),inventoryChoices(farmId,"locations"),inventoryChoices(farmId,"revenue-categories")]));
 return <ProductionShell farm={farm} active="poultry-batches" title="Record poultry event"><p className="mb-5">Use BIRD for purchases, deaths and sales; EGG for eggs; KG for feed. Enter the medicine unit explicitly. Bird sales need a category, amount and currency. Leave those money fields empty for other events. The first event places opening birds at the chosen location.</p><div className="max-w-2xl"><RecordForm label="Save poultry event" submit={savePoultryEvent.bind(null,farmId)} load={moreInventoryChoices.bind(null,farmId)} fields={[
 {name:"batchId",label:"Poultry batch",choices:batches,kind:"batches"}, {name:"locationId",label:"Store or flock housing",choices:locations,kind:"locations"},
 {name:"type",label:"Event",choices:{items:[{id:"PURCHASE",label:"Bird purchase"},{id:"MORTALITY",label:"Bird deaths"},{id:"BIRD_SALE",label:"Bird sale"},{id:"EGGS",label:"Eggs collected"},{id:"FEED",label:"Feed used"},{id:"MEDICATION",label:"Medication used"}],nextCursor:null}},
 {name:"quantity",label:"Quantity",type:"number",step:"0.000001",min:"0.000001"},{name:"unit",label:"Unit",defaultValue:"BIRD"},{name:"occurredOn",label:"Event date",type:"date"},{name:"note",label:"Note",optional:true},
 {name:"categoryId",label:"Sale category",optional:true,choices:categories,kind:"revenue-categories"},{name:"amount",label:"Sale amount",optional:true,type:"number",step:"0.0001",min:"0.0001"},{name:"currency",label:"Sale currency",optional:true}
 ]}/></div></ProductionShell>;
}
