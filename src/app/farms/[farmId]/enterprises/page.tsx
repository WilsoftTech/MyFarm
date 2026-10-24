import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { Button } from "@/components/ui/button";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import { enterpriseTypeLabels, productionStatusLabels } from "@/components/production/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Enterprises" };

export default async function EnterprisesPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ cursor?: string | string[] }> }) {
  const { farmId } = await params, { cursor } = await searchParams;
  const service = productionService(), path = "/farms/" + farmId + "/enterprises";
  const farm = await loadPage(() => service.farmContext(farmId));
  const page = await loadPage(() => service.listEnterprises(farmId, cursor === undefined ? {} : { cursor }));
  return <ProductionShell farm={farm} active="enterprises" title="Enterprises">
    <p className="mb-5 leading-7">Keep the parts of this farm you manage separately, such as maize, coffee and poultry.</p>
    <Button asChild><Link href={path + "/new"}>Add enterprise</Link></Button>
    {page.items.length === 0 ? <div className="mt-6 rounded-2xl border border-border bg-white p-6"><h2 className="text-xl font-semibold">{cursor ? "No more enterprises" : "No enterprises yet"}</h2><p className="mt-3 leading-7">{cursor ? "You have reached the end of this list." : "Add the first enterprise on this farm."}</p></div> :
      <ul aria-label="Enterprises on this farm" className="mt-6 grid gap-4 sm:grid-cols-2">{page.items.map(row => <li key={row.enterpriseId} className="min-w-0"><Link href={path + "/" + row.enterpriseId} className="block rounded-2xl border border-border bg-white p-6 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"><h2 className="break-words text-xl font-semibold">{row.name}</h2><p className="mt-3 text-sm">{enterpriseTypeLabels[row.type]} · {productionStatusLabels[row.status]}</p>{row.workflow === null && <p className="mt-2 text-sm leading-6 text-foreground/75">Production records not available yet.</p>}</Link></li>)}</ul>}
    <ProductionPagination path={path} cursor={typeof cursor === "string" ? cursor : undefined} nextCursor={page.nextCursor} />
  </ProductionShell>;
}
