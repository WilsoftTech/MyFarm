import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { RequestLimitPort } from "@/modules/engineering-foundation/contracts/request-limits";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { DashboardView, FarmScreen } from "@/modules/analytics-profitability/contracts/profitability";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { answerProblems } from "../domain/answer";
import { plainAnswer, type StoredAnswer } from "../domain/exchange";
import { explainRequest } from "../domain/explain-request";
import { answerRules, type AssistantPeriod, type Evidence, type EvidenceScope } from "../domain/evidence";
import { highestProfitEvidence } from "../domain/highest-profit";
import { explainProfitEvidence, farmReportEvidence, summarizeEvidence } from "../domain/money-tools";
import { compareSeasonsEvidence, earlierSeason, recordsEvidence, unusualCostsEvidence, upcomingTasksEvidence, type CostAlertInput, type RecordInput, type TaskInput } from "../domain/other-tools";
import { draftAnswer } from "../domain/tools";
import { askQuestionSchema, detectedIntentSchema, explainedAnswerSchema, explainerResultSchema, MAX_LISTED_QUESTIONS, type AssistantExchange, type AssistantProvider, type AssistantRepository, type AssistantUsageRecord, type Intent } from "../contracts/assistant";

/** Questions are counted per person (D-P11-004), on the database clock. */
export type QuestionLimits = Pick<RequestLimitPort, "take">;
const UNLIMITED: QuestionLimits = { take: async () => true };
/**
 * Where the tools read: only the farm's own authorized services, each re-checking the asker's membership (R002).
 * The assistant never queries records itself, never writes and never makes a file.
 */
export interface FarmSources {
  /** The farm screen (Phase 8, D-P08-008): dashboard, metrics and reconciliation for one view. */
  farmScreen(farmId: string, view: unknown): Promise<FarmScreen>;
  dashboard(farmId: string, view: unknown): Promise<DashboardView>;
  /** Latest money records, newest first (Phase 4). */
  records(farmId: string): Promise<{ items: RecordInput[]; more: boolean }>;
  /** Open alerts of the approved cost rules (Phase 10). */
  costAlerts(farmId: string): Promise<{ alerts: CostAlertInput[]; checked: number; notJudged: number }>;
  /** Work due from today, soonest first, and work past its date (Phase 6). */
  tasks(farmId: string): Promise<{ due: TaskInput[]; missed: TaskInput[]; moreDue: boolean; moreMissed: boolean }>;
}
/** The farm screen's figures as tool input. */
const moneyInput = (scope: EvidenceScope, view: DashboardView) => ({ scope, basis: view.basis, period: periodOf(view), asOf: view.asOf, currencies: view.currencies });
/** How long a provider may take before MyFarm's own answer is shown instead. */
export const PROVIDER_TIMEOUT_MS = 20_000;

/**
 * MYF-P11-R001: question → intent → authorization → farm figures → deterministic calculation → explanation, checked.
 * Records only (D-P11-005). Provider calls happen outside any database transaction, and whatever a provider returns
 * is untrusted: it can only choose words around placeholders MyFarm fills in.
 */
export class AssistantService {
  constructor(
    private readonly auth: RegistryAuthorization,
    private readonly farms: ProductionFarmAccess,
    private readonly sources: FarmSources,
    private readonly repo: AssistantRepository,
    private readonly provider: AssistantProvider,
    private readonly limits: QuestionLimits = UNLIMITED,
    private readonly timeoutMs: number = PROVIDER_TIMEOUT_MS,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** MYF-P11-R002: the bounded, read-only tool for each question type. */
  private async evidenceFor(intent: Exclude<Intent, "AGRONOMY" | "UNSUPPORTED">, scope: EvidenceScope, view: unknown): Promise<Evidence[]> {
    const asOf = this.now().toISOString();
    switch (intent) {
      case "HIGHEST_PROFIT": case "EXPLAIN_PROFIT": case "SUMMARIZE": case "FARM_REPORT": {
        const screen = await this.sources.farmScreen(scope.farmId, view);
        const input = moneyInput(scope, screen.dashboard);
        const evidence = intent === "HIGHEST_PROFIT" ? highestProfitEvidence(input) : intent === "EXPLAIN_PROFIT" ? explainProfitEvidence(input)
          : intent === "SUMMARIZE" ? summarizeEvidence(input) : farmReportEvidence({ ...input, costGroups: screen.metrics.costGroups });
        return evidence;
      }
      case "COMPARE_SEASONS": {
        const current = await this.sources.dashboard(scope.farmId, view);
        if (!current.season) return compareSeasonsEvidence({ scope, basis: current.basis, asOf: current.asOf, current: null, earlier: null });
        const before = earlierSeason(current.seasons, current.season);
        const earlier = before ? await this.sources.dashboard(scope.farmId, { basis: current.basis, seasonId: before.seasonId }) : null;
        return compareSeasonsEvidence({ scope, basis: current.basis, asOf: current.asOf, current: { season: current.season, currencies: current.currencies }, earlier: before && earlier ? { season: before, currencies: earlier.currencies } : null });
      }
      case "ASK_RECORDS": {
        const page = await this.sources.records(scope.farmId);
        return recordsEvidence({ scope, asOf, records: page.items, more: page.more });
      }
      case "UNUSUAL_COSTS": return unusualCostsEvidence({ scope, asOf, ...await this.sources.costAlerts(scope.farmId) });
      case "UPCOMING_TASKS": return upcomingTasksEvidence({ scope, asOf, today: farmToday(this.now()), ...await this.sources.tasks(scope.farmId) });
    }
  }

  async ask(farmId: unknown, input: unknown): Promise<AssistantExchange> {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const command = parse(askQuestionSchema, input);
    // A retry of the same question returns what was answered, free (no new count, no new provider call).
    const earlier = await this.repo.byRequest(scope, command.requestId);
    if (earlier) return earlier;
    if (!(await this.limits.take(scope.actorId, "ASSISTANT_QUESTION", command.requestId))) throw new FoundationError("RATE_LIMITED");
    const intent = await this.detect(command.question);
    const usage: AssistantUsageRecord = { provider: this.provider.name, model: null, calls: 0, inputTokens: 0, outputTokens: 0, costEstimateUsd: "0" };
    let answers: StoredAnswer[];
    if (intent === "AGRONOMY" || intent === "UNSUPPORTED") {
      answers = [plainAnswer(intent)];
    } else {
      const evidence = await this.evidenceFor(intent, { tenantId: scope.tenantId, farmId: scope.farmId }, command.view ?? {});
      answers = [];
      // One evidence at a time, in order, so a slow provider never runs several calls at once for one person.
      for (const item of evidence) answers.push(await this.explain(command.question, item, usage));
    }
    return this.repo.record(scope, { requestId: command.requestId, question: command.question, intent, answers: { answersVersion: 1, answers }, provider: this.provider.name, model: usage.model, usage: usage.calls > 0 ? usage : null });
  }

  async list(farmId: unknown): Promise<AssistantExchange[]> {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    return this.repo.list(scope, MAX_LISTED_QUESTIONS);
  }

  /** The farmer can delete a question before its 90 days (D-P11-003); another person's looks the same as none. */
  async remove(farmId: unknown, questionId: unknown): Promise<void> {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    if (!(await this.repo.remove(scope, parse(idSchema, questionId)))) throw new FoundationError("FORBIDDEN");
  }

  /** A detector that fails, stalls or returns anything but a bare intent leaves the question unsupported, never widened. */
  private async detect(question: string): Promise<Intent> {
    try {
      const result = detectedIntentSchema.safeParse(await this.withTimeout(this.provider.detector.detect(question)));
      return result.success ? result.data.intent : "UNSUPPORTED";
    } catch { return "UNSUPPORTED"; }
  }

  private async explain(question: string, evidence: Evidence, usage: AssistantUsageRecord): Promise<StoredAnswer> {
    const plain = (explainer: StoredAnswer["explainer"], problems: StoredAnswer["problems"] = []): StoredAnswer => ({ evidence, statements: draftAnswer(evidence).statements, source: "PLAIN", explainer, problems });
    // Missing evidence yields no conclusion: nothing to explain, and nothing to spend.
    if (evidence.outcome.status !== "ANSWERED") return plain("NOT_ASKED");
    usage.calls += 1;
    let raw: unknown;
    try { raw = await this.withTimeout(this.provider.explainer.explain(explainRequest(question, evidence))); }
    catch { return plain("UNAVAILABLE"); }
    const result = explainerResultSchema.safeParse(raw);
    if (!result.success) return plain("REFUSED", ["MALFORMED"]);
    usage.model = result.data.model;
    usage.inputTokens += result.data.inputTokens;
    usage.outputTokens += result.data.outputTokens;
    usage.costEstimateUsd = addDecimal(usage.costEstimateUsd, result.data.costEstimateUsd);
    const answer = explainedAnswerSchema.safeParse(result.data.output);
    if (!answer.success) return plain("REFUSED", ["MALFORMED"]);
    const problems = answerProblems(answer.data, answerRules(evidence));
    if (problems.length) return plain("REFUSED", problems);
    return { evidence, statements: answer.data.statements, source: "EXPLAINER", explainer: "USED", problems: [] };
  }

  private withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("provider timeout")), this.timeoutMs); });
    return Promise.race([work, expired]).finally(() => clearTimeout(timer));
  }
}

/** The period the farm screen showed: one season, chosen dates, or every record. */
export function periodOf(view: Pick<DashboardView, "season" | "from" | "to">): AssistantPeriod {
  if (view.season) return { kind: "SEASON", label: view.season.label, startDate: view.season.startDate, endDate: view.season.endDate };
  if (view.from || view.to) return { kind: "DATES", from: view.from, to: view.to };
  return { kind: "ALL_RECORDS" };
}

/** Exact sum of two non-negative decimals with up to 6 places, as text. */
function addDecimal(a: string, b: string): string {
  const units = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0")); };
  const total = units(a) + units(b);
  const fraction = (total % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return (total / 1_000_000n).toString() + (fraction ? "." + fraction : "");
}
