import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { RecordForm } from "@/components/production/record-form";
import { saveStorage, moreInventoryChoices } from "../inventory-actions";
export const dynamic = "force-dynamic";
export default async function Stores({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string }> }) {
 const { farmId } = await params, { cursor } = await searchParams;
 const farm = await loadPage(() => productionService().farmContext(farmId));
 const page = await loadPage(() => harvestService().locations(farmId, cursor ? { cursor } : {}));
 return <ProductionShell farm={farm} active="storage-locations" title="Stores"><ul className="mb-6 space-y-3">{page.items.map(r => <li key={r.storageLocationId}>{r.name}</li>)}</ul>{!page.items.length && <p>No stores on this page.</p>}
 <ProductionPagination path={"/farms/" + farmId + "/storage-locations"} cursor={cursor} nextCursor={page.nextCursor} />
 <div className="mt-6 max-w-xl"><RecordForm key={page.items.length} label="Add store" fields={[{ name: "name", label: "Store name" }]} submit={saveStorage.bind(null, farmId)} load={moreInventoryChoices.bind(null, farmId)} /></div></ProductionShell>;
}
