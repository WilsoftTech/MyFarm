import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { RecordForm } from "@/components/production/record-form";
import { inventoryChoices, moreInventoryChoices, saveHarvest } from "../../inventory-actions";
export const dynamic = "force-dynamic";
export default async function NewHarvest({ params }: { params: Promise<{ farmId: string }> }) {
 const { farmId } = await params;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const [cycles, stores] = await loadPage(() => Promise.all([inventoryChoices(farmId, "cycles"), inventoryChoices(farmId, "locations")]));
 return <ProductionShell farm={farm} active="harvests" title="Record harvest"><p className="mb-4">Enter kilograms. Bags are not converted. Loss is part of the gross harvest, not an additional harvest.</p>
 <Link href={"/farms/" + farmId + "/storage-locations"} className="inline-block min-h-12 py-3 underline">Add or view stores</Link>
 {!cycles.items.length && !cycles.nextCursor ? <p>Start a crop cycle before recording its harvest.</p> : !stores.items.length && !stores.nextCursor ? <p>Add a named store before recording a harvest.</p> :
 <div className="max-w-2xl rounded-xl border p-5"><RecordForm label="Save harvest" submit={saveHarvest.bind(null, farmId)} load={moreInventoryChoices.bind(null, farmId)} fields={[
 { name: "cropCycleId", label: "Crop cycle", choices: cycles, kind: "cycles" }, { name: "storageLocationId", label: "Store", choices: stores, kind: "locations" },
 { name: "harvestDate", label: "Harvest date", type: "date" }, { name: "quantity", label: "Harvested kilograms", type: "number", step: "0.000001", min: "0.000001" },
 { name: "lossQuantity", label: "Initial loss in kilograms", type: "number", step: "0.000001", min: "0", defaultValue: "0" }, { name: "grade", label: "Grade", optional: true }
 ]} /></div>}</ProductionShell>;
}
