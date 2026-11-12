import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { ProductionShell } from "@/components/production/shell";
import { InsightFeedView } from "@/components/intelligence/insight-feed";
import { acknowledgeInsight } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Alerts" };
export default async function InsightsPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ seen?: string }> }) {
  const { farmId } = await params;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  // Over the per-person limit (D-P10-009) the page says so plainly instead of failing.
  const feed = await loadPage(() => farmIntelligenceService().feed(farmId).catch((error: unknown) => {
    if (error instanceof FoundationError && error.code === "RATE_LIMITED") return null;
    throw error;
  }));
  const seen = (await searchParams).seen;
  if (!feed) return <ProductionShell farm={farm} active="insights" title="Alerts">
    <p role="alert" className="rounded-xl bg-muted p-4">Alerts were checked many times in the last minute. Wait a minute, then open this page again. Your records are safe.</p>
  </ProductionShell>;
  return <ProductionShell farm={farm} active="insights" title="Alerts">
    {seen && feed.insights.some(row => row.insightId === seen && row.status === "ACKNOWLEDGED") && <p role="status" className="mb-4 rounded-xl bg-muted p-4">Marked as seen.</p>}
    <InsightFeedView feed={feed} acknowledge={(insightId, version) => acknowledgeInsight.bind(null, farm.farmId, insightId, version)} />
  </ProductionShell>;
}
