import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { PoultryBatchForm } from "@/components/production/poultry-batch-form";
import { loadPoultryChoices } from "@/components/production/poultry-choices";
import { startPoultryBatchAction, morePoultryChoicesAction } from "../../production-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Add poultry batch" };
export default async function NewPoultryBatchPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ enterpriseId?: string | string[] }> }) {
  const { farmId } = await params, { enterpriseId } = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const preset = enterpriseId === undefined ? undefined : await loadPage(() => productionService().enterprise(farmId, enterpriseId));
  const [enterprises, animalTypes] = await loadPage(() => Promise.all([loadPoultryChoices(farmId, "enterprises"), loadPoultryChoices(farmId, "animal-types")]));
  if (preset && !enterprises.items.some(row => row.id === preset.enterpriseId)) enterprises.items.push({ id: preset.enterpriseId, label: preset.name, disabled: preset.type !== "POULTRY" || preset.status !== "ACTIVE" });
  return <ProductionShell farm={farm} active="poultry-batches" title="Add poultry batch"><p className="mb-5 leading-7">Record a group of birds kept together. The batch name and enterprise are checked when you save.</p><div className="max-w-2xl rounded-2xl border border-border bg-white p-5 sm:p-6"><PoultryBatchForm farmId={farm.farmId} enterpriseId={preset?.enterpriseId} choices={{ enterprises, "animal-types": animalTypes }} submit={startPoultryBatchAction.bind(null, farm.farmId)} load={morePoultryChoicesAction.bind(null, farm.farmId)} /></div></ProductionShell>;
}
