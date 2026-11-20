import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { VoiceExpenseForm } from "@/components/voice/expense-form";
import { loadAccountingChoices } from "@/components/accounting/link-choices";
import { moreAccountingChoicesAction } from "../accounting/actions";
import { voiceDraftService, voiceInputService } from "@/modules/voice-experience/infrastructure/services";
export const dynamic = "force-dynamic";
export const metadata = { title: "Review an expense" };

export default async function VoiceExpensePage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ draft?: string }> }) {
  const { farmId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const search = await searchParams;
  const outcome = search.draft ? await loadPage(() => voiceDraftService().outcome(farmId, search.draft)) : undefined;
  const [categories, methods, enterprises, seasons, plots, batches, capabilities] = await loadPage(() => Promise.all([
    farmAccountingService().categories(farmId, { kind: "COST", limit: 50 }), farmAccountingService().paymentMethods(farmId, { limit: 50 }),
    loadAccountingChoices(farmId, "enterprises"), loadAccountingChoices(farmId, "seasons"), loadAccountingChoices(farmId, "plots"), loadAccountingChoices(farmId, "batches"),
    voiceInputService().capabilities(farmId),
  ]));
  return <ProductionShell farm={farm} active="voice" title="Review an expense"><VoiceExpenseForm key={farm.farmId + ":" + (search.draft ?? "new")} farmId={farm.farmId} farmName={farm.name}
    categories={categories.items.map(row => ({ id: row.categoryId, label: row.name }))} paymentMethods={methods.items.map(row => ({ id: row.paymentMethodId, label: row.name }))}
    outcome={outcome} capabilities={capabilities} links={{ pages: { enterprises, seasons, plots, batches }, load: moreAccountingChoicesAction.bind(null, farm.farmId) }} /></ProductionShell>;
}
