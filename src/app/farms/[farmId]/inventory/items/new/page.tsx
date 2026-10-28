import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
export const dynamic="force-dynamic";
import {moreInventoryChoices,saveInventoryItem} from "../../../inventory-actions";
export default async function NewItem({params}:{params:Promise<{farmId:string}>}) {const {farmId}=await params;const farm=await loadPage(()=>productionService().farmContext(farmId));return <ProductionShell farm={farm} active="inventory" title="Add supply item"><p className="mb-5">Choose one explicit unit, for example KG, ML or UNIT. No conversions are made. Crop and poultry items come from their own records. Add an owner-reviewed adjustment to record opening stock.</p><RecordForm label="Add supply item" submit={saveInventoryItem.bind(null,farmId)} load={moreInventoryChoices.bind(null,farmId)} fields={[{name:"name",label:"Item name"},{name:"unit",label:"Unit"}]}/></ProductionShell>;}
