import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { CropCycleForm } from "@/components/production/crop-cycle-form";
import { loadCropChoices } from "@/components/production/crop-choices";
import { startCropCycleAction, moreCropChoicesAction } from "../../production-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Start crop cycle" };
export default async function NewCropCyclePage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ enterpriseId?: string | string[] }> }) {
  const { farmId } = await params, { enterpriseId } = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const preset = enterpriseId === undefined ? undefined : await loadPage(() => productionService().enterprise(farmId, enterpriseId));
  const [enterprises, seasons, plots, crops] = await loadPage(() => Promise.all([loadCropChoices(farmId, "enterprises"), loadCropChoices(farmId, "seasons"), loadCropChoices(farmId, "plots"), loadCropChoices(farmId, "crops")]));
  if (preset && !enterprises.items.some(row => row.id === preset.enterpriseId)) enterprises.items.push({ id: preset.enterpriseId, label: preset.name, disabled: preset.type !== "CROP" || preset.status !== "ACTIVE" });
  return <ProductionShell farm={farm} active="crop-cycles" title="Start crop cycle"><p className="mb-5 leading-7">Record planting on one plot and season. Dates and available plot area are checked when you save.</p><div className="max-w-2xl rounded-2xl border border-border bg-white p-5 sm:p-6"><CropCycleForm farmId={farm.farmId} enterpriseId={preset?.enterpriseId} choices={{ enterprises, seasons, plots, crops }} submit={startCropCycleAction.bind(null, farm.farmId)} load={moreCropChoicesAction.bind(null, farm.farmId)} /></div></ProductionShell>;
}
