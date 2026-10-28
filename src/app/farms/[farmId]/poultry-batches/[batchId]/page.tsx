import Link from "next/link";
import { productionService, poultryBatchService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { birdCount, currentQuantitySourceLabels, poultryPurposeLabels, productionStatusLabels } from "@/components/production/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Poultry batch" };
export default async function PoultryBatchPage({ params, searchParams }: { params: Promise<{ farmId: string; batchId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { farmId, batchId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const row = await loadPage(() => poultryBatchService().batch(farmId, batchId));
  const enterprise = await loadPage(() => productionService().enterprise(farmId, row.enterpriseId));
  return <ProductionShell farm={farm} active="poultry-batches" title={row.batchLabel}>
    {(await searchParams).saved === "1" && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Poultry batch saved.</p>}
    <Link className="inline-block min-h-12 py-3 underline" href={"/farms/" + farmId + "/poultry-production/" + batchId}>Production and flock history</Link>
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div className="sm:col-span-2"><dt className="text-sm text-foreground/70">Current number of birds</dt><dd className="mt-1 text-2xl font-semibold">{birdCount(row.currentQuantity)}</dd><dd className="mt-1 text-sm leading-6 text-foreground/75">{currentQuantitySourceLabels[row.currentQuantitySource]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Starting number of birds</dt><dd className="mt-1 font-semibold">{birdCount(row.startingQuantity)}</dd></div>
      <div><dt className="text-sm text-foreground/70">Acquisition date</dt><dd className="mt-1 font-semibold"><time dateTime={row.acquisitionDate}>{row.acquisitionDate}</time></dd></div>
      <div><dt className="text-sm text-foreground/70">Enterprise</dt><dd className="mt-1 break-words font-semibold"><Link className="underline" href={"/farms/" + farm.farmId + "/enterprises/" + enterprise.enterpriseId}>{enterprise.name}</Link></dd></div>
      <div><dt className="text-sm text-foreground/70">Animal type</dt><dd className="mt-1 break-words font-semibold">{row.animalTypeName}</dd></div>
      <div><dt className="text-sm text-foreground/70">Breed</dt><dd className="mt-1 break-words font-semibold">{row.breed ?? "Not recorded"}</dd></div>
      <div><dt className="text-sm text-foreground/70">Production purpose</dt><dd className="mt-1 font-semibold">{poultryPurposeLabels[row.purpose]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{productionStatusLabels[row.status]}</dd></div>
    </dl>
  </ProductionShell>;
}
