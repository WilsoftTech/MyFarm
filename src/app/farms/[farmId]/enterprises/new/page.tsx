import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { EnterpriseForm } from "@/components/production/enterprise-form";
import { ProductionShell } from "@/components/production/shell";
import { createEnterpriseAction } from "../../production-actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Add enterprise" };

export default async function NewEnterprisePage({ params }: { params: Promise<{ farmId: string }> }) {
  const { farmId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  return <ProductionShell farm={farm} active="enterprises" title="Add enterprise"><div className="max-w-xl rounded-2xl border border-border bg-white p-5 sm:p-6"><EnterpriseForm submit={createEnterpriseAction.bind(null, farm.farmId)} /></div></ProductionShell>;
}
