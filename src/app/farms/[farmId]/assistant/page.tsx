import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { farmProfitabilityService } from "@/modules/analytics-profitability/infrastructure/services";
import { assistantService } from "@/modules/ai-assistant/infrastructure/services";
import { loadPage } from "@/app/farmer/guard";
import { ProductionShell } from "@/components/production/shell";
import { AskForm } from "@/components/assistant/ask-form";
import { LabelGuide, QuestionCard } from "@/components/assistant/answer-view";
import { askQuestion, deleteQuestion } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ask about this farm" };

/** MYF-P11-R001: questions about this farm, answered only from its own records (D-P11-005). */
export default async function AssistantPage({ params, searchParams }: { params: Promise<{ farmId: string }>; searchParams: Promise<{ asked?: string; deleted?: string }> }) {
  const { farmId } = await params, search = await searchParams;
  const farm = await loadPage(() => productionService().farmContext(farmId));
  // The same default as the farm screen: the latest active season, or all records (D-P08-008).
  const view = await loadPage(() => farmProfitabilityService().dashboard(farmId, {}));
  const questions = await loadPage(() => assistantService().list(farmId));
  return <ProductionShell farm={farm} active="assistant" title="Ask about this farm">
    <p className="mb-5 max-w-3xl leading-7">Answers come only from this farm&apos;s records. MyFarm works out every figure itself; nothing is guessed. For advice on crops or animals, ask an extension officer.</p>
    {search.deleted && <p role="status" className="mb-4 rounded-xl bg-muted p-4">Question deleted.</p>}
    <AskForm seasons={view.seasons.map(season => ({ seasonId: season.seasonId, label: season.label, closed: season.status === "CLOSED" }))} defaultSeason={view.season?.seasonId ?? "all"} submit={askQuestion.bind(null, farm.farmId)} />
    <LabelGuide />
    <section aria-labelledby="your-questions" className="mt-8">
      <h2 id="your-questions" className="text-2xl font-semibold">Your questions</h2>
      <p className="mt-1 text-sm leading-6 text-foreground/80">Only you can see your questions. Each is kept 90 days, then deleted.</p>
      {questions.length === 0 ? <p className="mt-4 leading-7">You have not asked anything on this farm yet.</p>
        : <ol className="mt-4 space-y-4">{questions.map(exchange => <QuestionCard key={exchange.questionId} exchange={exchange} farmId={farm.farmId} remove={deleteQuestion.bind(null, farm.farmId, exchange.questionId)} />)}</ol>}
    </section>
  </ProductionShell>;
}
