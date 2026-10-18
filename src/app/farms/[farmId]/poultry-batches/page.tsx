import Link from "next/link";
import { productionService, poultryBatchService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { birdCount, poultryPurposeLabels, productionStatusLabels } from "@/components/production/labels";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "Poultry batches" };
export default async function PoultryBatchesPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { farmId } = await params, { cursor } = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const page = await loadPage(() => poultryBatchService().list(farmId, cursor === undefined ? {} : { cursor }));
  const path = "/farms/" + farm.farmId + "/poultry-batches";
  return <ProductionShell farm={farm} active="poultry-batches" title="Poultry batches"><p className="mb-5 leading-7">Groups of birds on this farm, across its poultry enterprises.</p><Button asChild><Link href={path + "/new"}>Add poultry batch</Link></Button>
    {page.items.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">{cursor ? "No more poultry batches" : "No poultry batches yet"}</h2><p className="mt-3 leading-7">{cursor ? "You have reached the end of this list." : "Add a poultry batch to record a group of birds."}</p></div> : <ul aria-label="Poultry batches on this farm" className="mt-6 grid gap-4 sm:grid-cols-2">{page.items.map(row => <li key={row.batchId} className="min-w-0"><Link href={path + "/" + row.batchId} className="block rounded-2xl border border-border bg-white p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"><h2 className="break-words text-xl font-semibold">{row.batchLabel}</h2><p className="mt-3 break-words leading-7">{row.animalTypeName}{row.breed ? " — " + row.breed : ""} · {poultryPurposeLabels[row.purpose]}</p><p className="leading-7">{birdCount(row.currentQuantity)} · acquired <time dateTime={row.acquisitionDate}>{row.acquisitionDate}</time></p><p className="text-sm">{productionStatusLabels[row.status]}</p></Link></li>)}</ul>}
    <ProductionPagination path={path} cursor={typeof cursor === "string" ? cursor : undefined} nextCursor={page.nextCursor} />
  </ProductionShell>;
}
