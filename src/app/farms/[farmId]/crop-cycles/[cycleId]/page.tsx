import Link from "next/link";
import { productionService, cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { productionStatusLabels } from "@/components/production/labels";
import { areaUnitLabels } from "@/components/farmer-registry/labels";
import { ProductionClosureForm } from "@/components/production/closure-form";
import { closeProductionAction } from "../../production-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Crop cycle" };
export default async function CropCyclePage({ params, searchParams }: { params: Promise<{ farmId: string; cycleId: string }>; searchParams: Promise<{ saved?: string; closed?: string }> }) {
  const { farmId, cycleId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const row = await loadPage(() => cropCycleService().cycle(farmId, cycleId));
  const [enterprise, season, plot] = await loadPage(() => Promise.all([productionService().enterprise(farmId, row.enterpriseId), productionService().season(farmId, row.seasonId), cropCycleService().plot(farmId, row.plotId)]));
  return <ProductionShell farm={farm} active="crop-cycles" title={row.cropName + " crop cycle"}>
    {(await searchParams).saved === "1" && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Crop cycle saved.</p>}
    {(await searchParams).closed === "1" && row.status === "CLOSED" && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Crop cycle closed.</p>}
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div><dt className="text-sm text-foreground/70">Enterprise</dt><dd className="mt-1 break-words font-semibold"><Link className="underline" href={"/farms/" + farm.farmId + "/enterprises/" + enterprise.enterpriseId}>{enterprise.name}</Link></dd></div>
      <div><dt className="text-sm text-foreground/70">Season</dt><dd className="mt-1 break-words font-semibold"><Link className="underline" href={"/farms/" + farm.farmId + "/seasons/" + season.seasonId}>{season.label}</Link></dd></div>
      <div><dt className="text-sm text-foreground/70">Plot</dt><dd className="mt-1 break-words font-semibold">{plot.name}</dd></div>
      <div><dt className="text-sm text-foreground/70">Variety</dt><dd className="mt-1 break-words font-semibold">{row.variety ?? "Not recorded"}</dd></div>
      <div><dt className="text-sm text-foreground/70">Area planted</dt><dd className="mt-1 font-semibold">{row.areaPlanted} {areaUnitLabels[row.areaUnit]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{productionStatusLabels[row.status]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Planting date</dt><dd className="mt-1 font-semibold"><time dateTime={row.plantingDate}>{row.plantingDate}</time></dd></div>
      <div><dt className="text-sm text-foreground/70">Expected harvest date</dt><dd className="mt-1 font-semibold">{row.expectedHarvest ? <time dateTime={row.expectedHarvest}>{row.expectedHarvest}</time> : "Not recorded — open-ended cycle"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-sm text-foreground/70">Reason for extra planted area</dt><dd className="mt-1 break-words font-semibold">{row.areaExceptionReason ?? "Not recorded"}</dd></div>
    </dl>
    {row.status === "ACTIVE" && <ProductionClosureForm label="crop cycle" version={row.version} submit={closeProductionAction.bind(null, farmId, "CROP_CYCLE", cycleId)} />}
  </ProductionShell>;
}
