import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { SeasonForm } from "@/components/production/season-form";
import { ProductionShell } from "@/components/production/shell";
import { createSeasonAction } from "../../production-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Add season" };

export default async function NewSeasonPage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  return <ProductionShell farm={farm} active="seasons" title="Add season"><div className="max-w-xl rounded-2xl border border-border bg-white p-5 sm:p-6"><SeasonForm submit={createSeasonAction.bind(null, farm.farmId)} /></div></ProductionShell>;
}
