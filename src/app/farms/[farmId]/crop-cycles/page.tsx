import Link from "next/link";
import { productionService, cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { productionStatusLabels } from "@/components/production/labels";
import { areaUnitLabels } from "@/components/farmer-registry/labels";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export const metadata = { title: "Crop cycles" };
export default async function CropCyclesPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { farmId } = await params, { cursor } = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const page = await loadPage(() => cropCycleService().list(farmId, cursor === undefined ? {} : { cursor }));
  const path = "/farms/" + farm.farmId + "/crop-cycles";
  return <ProductionShell farm={farm} active="crop-cycles" title="Crop cycles"><p className="mb-5 leading-7">Planting records on this farm, across its enterprises and seasons.</p><Button asChild><Link href={path + "/new"}>Start crop cycle</Link></Button>
    {page.items.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">{cursor ? "No more crop cycles" : "No crop cycles yet"}</h2><p className="mt-3 leading-7">{cursor ? "You have reached the end of this list." : "Start a crop cycle to record planting."}</p></div> : <ul aria-label="Crop cycles on this farm" className="mt-6 grid gap-4 sm:grid-cols-2">{page.items.map(row => <li key={row.cycleId} className="min-w-0"><Link href={path + "/" + row.cycleId} className="block rounded-2xl border border-border bg-white p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"><h2 className="break-words text-xl font-semibold">{row.cropName}{row.variety ? " — " + row.variety : ""}</h2><p className="mt-3 leading-7">Planted <time dateTime={row.plantingDate}>{row.plantingDate}</time> · {row.areaPlanted} {areaUnitLabels[row.areaUnit]}</p><p className="text-sm">{productionStatusLabels[row.status]}</p></Link></li>)}</ul>}
    <ProductionPagination path={path} cursor={typeof cursor === "string" ? cursor : undefined} nextCursor={page.nextCursor} />
  </ProductionShell>;
}
