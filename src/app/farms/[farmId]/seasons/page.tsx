import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { Button } from "@/components/ui/button";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { productionStatusLabels } from "@/components/production/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Seasons" };

export default async function SeasonsPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { farmId } = await params, { cursor } = await searchParams;
  const service = productionService(), path = "/farms/" + farmId + "/seasons";
  const farm = await loadPage(() => service.farmContext(farmId));
  const page = await loadPage(() => service.listSeasons(farmId, cursor === undefined ? {} : { cursor }));
  return <ProductionShell farm={farm} active="seasons" title="Seasons">
    <p className="mb-5 leading-7">Name the periods you use to organise this farm. Seasons may overlap.</p>
    <Button asChild><Link href={path + "/new"}>Add season</Link></Button>
    {page.items.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">{cursor ? "No more seasons" : "No seasons yet"}</h2><p className="mt-3 leading-7">{cursor ? "You have reached the end of this list." : "Add the first season on this farm."}</p></div> :
      <ul aria-label="Seasons on this farm" className="mt-6 grid gap-4 sm:grid-cols-2">{page.items.map(row => <li key={row.seasonId} className="min-w-0"><Link href={path + "/" + row.seasonId} className="block rounded-2xl border border-border bg-white p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"><h2 className="break-words text-xl font-semibold">{row.label}</h2><p className="mt-3 text-sm">{productionStatusLabels[row.status]} · Starts <time dateTime={row.startDate}>{row.startDate}</time></p><p className="mt-2 text-sm">{row.endDate ? <>Ends <time dateTime={row.endDate}>{row.endDate}</time></> : "End date not recorded"}</p></Link></li>)}</ul>}
    <ProductionPagination path={path} cursor={typeof cursor === "string" ? cursor : undefined} nextCursor={page.nextCursor} />
  </ProductionShell>;
}
