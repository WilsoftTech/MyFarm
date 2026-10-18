import Link from "next/link";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { productionStatusLabels } from "@/components/production/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Season" };

export default async function SeasonPage({ params, searchParams }: { params: Promise<{ farmId: string; seasonId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { farmId, seasonId } = await params;
  const service = productionService();
  const farm = await loadPage(() => service.farmContext(farmId));
  const row = await loadPage(() => service.season(farmId, seasonId));
  const saved = (await searchParams).saved === "1";
  return <ProductionShell farm={farm} active="seasons" title={row.label}>
    {saved && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Season saved.</p>}
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div><dt className="text-sm text-foreground/70">Start date</dt><dd className="mt-1 font-semibold"><time dateTime={row.startDate}>{row.startDate}</time></dd></div>
      <div><dt className="text-sm text-foreground/70">End date</dt><dd className="mt-1 font-semibold">{row.endDate ? <time dateTime={row.endDate}>{row.endDate}</time> : "Not recorded"}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{productionStatusLabels[row.status]}</dd></div>
    </dl>
    <p className="mt-6 leading-7">This season belongs to {farm.name}. <Link className="underline" href={"/farms/" + farm.farmId + "/crop-cycles"}>View farm crop cycles</Link>. Season closure is not available yet.</p>
  </ProductionShell>;
}
