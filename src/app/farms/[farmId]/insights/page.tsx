import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { InsightFeedView } from "@/components/intelligence/insight-feed";
import { acknowledgeInsight } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts" };
export default async function InsightsPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ seen?: string }> }) {
  const { farmId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  const feed = await loadPage(() => farmIntelligenceService().feed(farmId));
  const seen = (await searchParams).seen;
  return <ProductionShell farm={farm} active="insights" title="Alerts">
    {seen && feed.insights.some(row => row.insightId === seen && row.status === "ACKNOWLEDGED") && <p role="status" className="mb-4 rounded-xl bg-muted p-4">Marked as seen.</p>}
    <InsightFeedView feed={feed} acknowledge={(insightId, version) => acknowledgeInsight.bind(null, farm.farmId, insightId, version)} />
  </ProductionShell>;
}
