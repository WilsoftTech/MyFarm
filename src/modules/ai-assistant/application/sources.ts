import type { AccountingRecordView } from "@/modules/farm-accounting/contracts/accounting";
import type { ActivityView } from "@/modules/farm-activities/contracts/activity";
import { isThresholdEvidence, type InsightFeed } from "@/modules/farm-intelligence/contracts/insights";
import { COST_RULE_TITLES, MAX_RECORDS, MAX_TASKS, type CostAlertInput, type CostRule, type RecordInput, type TaskInput } from "../domain/other-tools";
import type { FarmSources } from "./assistant";

/** Each source module's own view, reduced to what a tool needs (MYF-P11-R002). Pure, so each mapping is tested. */
export function recordOf(row: Pick<AccountingRecordView, "recordId" | "kind" | "categoryId" | "categoryName" | "amount" | "currency" | "occurredOn" | "enterpriseId" | "enterpriseName" | "status">): RecordInput {
  return { recordId: row.recordId, kind: row.kind, categoryId: row.categoryId, categoryName: row.categoryName, amount: row.amount, currency: row.currency, occurredOn: row.occurredOn, enterpriseId: row.enterpriseId, enterpriseName: row.enterpriseName, status: row.status };
}

export function taskOf(row: Pick<ActivityView, "activityId" | "type" | "typeLabel" | "dueOn" | "enterpriseId" | "enterpriseName">): TaskInput {
  return { activityId: row.activityId, type: row.type, typeLabel: row.typeLabel, dueOn: row.dueOn, enterpriseId: row.enterpriseId, enterpriseName: row.enterpriseName };
}

const isCostRule = (rule: string): rule is CostRule => rule in COST_RULE_TITLES;
const LOSS_RULES = new Set(["LOSS_PER_EGG", "LOSS_PER_BIRD", "LOSS_PER_KG"]);

/** Open alerts of the five approved cost rules, with the figures they were raised on; and what the rules could not judge. */
export function costAlertsOf(feed: InsightFeed): { alerts: CostAlertInput[]; checked: number; notJudged: number } {
  const alerts: CostAlertInput[] = [];
  for (const insight of feed.insights) {
    if (!isCostRule(insight.ruleKey) || insight.status === "CLEARED") continue;
    const evidence = insight.evidence;
    if (isThresholdEvidence(evidence)) {
      const values = evidence.figure.values, currency = evidence.figure.currency ?? insight.currency;
      if (!currency || !values.costPerUnit || !values.pricePerUnit) continue;
      alerts.push({ insightId: insight.insightId, rule: insight.ruleKey as "LOSS_PER_EGG" | "LOSS_PER_BIRD" | "LOSS_PER_KG", subject: evidence.subject.label, subjectId: insight.batchId ?? insight.cropCycleId ?? evidence.subject.label, currency, costPerUnit: values.costPerUnit, pricePerUnit: values.pricePerUnit });
    } else {
      const feedCost = evidence.figures.find(figure => figure.rule === "FEED_COST_RISING");
      if (!feedCost?.currency || feedCost.earlier === null || feedCost.current === null || feedCost.change === null || !insight.batchId) continue;
      alerts.push({ insightId: insight.insightId, rule: insight.ruleKey as "FEED_COST_RISING" | "PRODUCTION_FALLING_COSTS_RISING", subject: evidence.batchLabel, subjectId: insight.batchId, currency: feedCost.currency, earlier: feedCost.earlier, current: feedCost.current, change: feedCost.change });
    }
  }
  const notJudged = feed.notJudged.filter(row => row.rule === "FEED_COST_RISING").length + feed.thresholdsNotJudged.filter(row => LOSS_RULES.has(row.rule)).length;
  return { alerts, checked: feed.batchesChecked + feed.cropCyclesChecked, notJudged };
}

/** The read services the tools use, each already authorized as the asking person. */
export interface SourceServices {
  profitability: Pick<FarmSources, "farmScreen" | "dashboard">;
  accounting: { records(farmId: unknown, input: unknown): Promise<{ items: Parameters<typeof recordOf>[0][]; nextCursor: string | null }> };
  intelligence: { feed(farmId: unknown): Promise<InsightFeed> };
  activities: { list(farmId: unknown, input: unknown): Promise<{ items: Parameters<typeof taskOf>[0][]; nextCursor: string | null }> };
}

/** One wiring for the app and the tests: bounded reads, each through its module's own authorized service. */
export function sourcesFrom(services: SourceServices): FarmSources {
  return {
    farmScreen: (farmId, view) => services.profitability.farmScreen(farmId, view),
    dashboard: (farmId, view) => services.profitability.dashboard(farmId, view),
    async records(farmId) {
      // A few more than are shown, so reversed records left out do not shorten the list.
      const page = await services.accounting.records(farmId, { limit: MAX_RECORDS * 2 });
      return { items: page.items.map(recordOf), more: page.nextCursor !== null };
    },
    async costAlerts(farmId) { return costAlertsOf(await services.intelligence.feed(farmId)); },
    async tasks(farmId) {
      const [today, upcoming, missed] = await Promise.all((["TODAY", "UPCOMING", "MISSED"] as const).map(bucket => services.activities.list(farmId, { bucket, limit: MAX_TASKS })));
      return { due: [...today.items, ...upcoming.items].map(taskOf), missed: missed.items.map(taskOf), moreDue: today.nextCursor !== null || upcoming.nextCursor !== null, moreMissed: missed.nextCursor !== null };
    },
  };
}
