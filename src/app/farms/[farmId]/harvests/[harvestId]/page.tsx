import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
export const dynamic = "force-dynamic";
export default async function Harvest({ params }: { params: Promise<{ farmId: string; harvestId: string }> }) {
 const { farmId, harvestId } = await params;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const r = await loadPage(() => harvestService().detail(farmId, harvestId));
 return <ProductionShell farm={farm} active="harvests" title={r.cropName + " harvest"}><dl className="grid gap-5 rounded-xl border p-5 sm:grid-cols-2">{[
 ["Harvest date", r.harvestDate], ["Gross harvest", r.quantity + " kg"], ["Initial loss", r.lossQuantity + " kg"], ["Initially stored", r.storedQuantity + " kg"], ["Store", r.storageLocationName], ["Grade", r.grade ?? "Not recorded"]
 ].map(([k,v]) => <div key={k}><dt className="text-sm">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>)}</dl><p className="mt-5">This is the original harvest record. Current stock is derived from all inventory movements. Inventory monetary value is not available.</p></ProductionShell>;
}
