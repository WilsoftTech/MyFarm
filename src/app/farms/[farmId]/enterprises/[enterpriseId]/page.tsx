import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { enterpriseTypeLabels, productionStatusLabels } from "@/components/production/labels";
export const dynamic = "force-dynamic";
export const metadata = { title: "Enterprise" };

export default async function EnterprisePage({ params, searchParams }: { params: Promise<{ farmId: string; enterpriseId: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { farmId, enterpriseId } = await params;
  const service = productionService();
  const farm = await loadPage(() => service.farmContext(farmId));
  const row = await loadPage(() => service.enterprise(farmId, enterpriseId));
  const saved = (await searchParams).saved === "1";
  return <ProductionShell farm={farm} active="enterprises" title={row.name}>
    {saved && <p role="status" className="mb-6 rounded-xl bg-muted p-4">Enterprise saved.</p>}
    <dl className="grid gap-5 rounded-2xl border border-border bg-white p-6 sm:grid-cols-2">
      <div><dt className="text-sm text-foreground/70">Enterprise type</dt><dd className="mt-1 font-semibold">{enterpriseTypeLabels[row.type]}</dd></div>
      <div><dt className="text-sm text-foreground/70">Status</dt><dd className="mt-1 font-semibold">{productionStatusLabels[row.status]}</dd></div>
    </dl>
    <p className="mt-6 leading-7">{row.type === "CROP" ? "Crop cycle records are not available yet." : row.type === "POULTRY" ? "Poultry batch records are not available yet." : "Production records for this enterprise type are not available yet."} Your enterprise name and type are saved here.</p>
  </ProductionShell>;
}
