import type { Answer } from "./answer";
import type { Draft, DraftSource, ToolKey } from "./evidence";
import { draftHighestProfitAnswer, HIGHEST_PROFIT_TOOL } from "./highest-profit";
import { draftExplainProfitAnswer, draftFarmReportAnswer, draftSummarizeAnswer, EXPLAIN_PROFIT_TOOL, FARM_REPORT_TOOL, SUMMARIZE_TOOL } from "./money-tools";
import { ASK_RECORDS_TOOL, COMPARE_SEASONS_TOOL, draftCompareSeasonsAnswer, draftRecordsAnswer, draftUnusualCostsAnswer, draftUpcomingTasksAnswer, UNUSUAL_COSTS_TOOL, UPCOMING_TASKS_TOOL } from "./other-tools";

/**
 * MYF-P11-R002: every question type the assistant answers, each a bounded, read-only tool with a version and a plain
 * answer. The seven source capabilities (P0627-P0633) plus the R001 example.
 */
export const TOOLS: Readonly<Record<ToolKey, { version: number; draft: Draft; reads: string }>> = Object.freeze({
  HIGHEST_PROFIT: { version: HIGHEST_PROFIT_TOOL.version, draft: draftHighestProfitAnswer, reads: "Farm screen: enterprise gross margin (Phase 8)" },
  ASK_RECORDS: { version: ASK_RECORDS_TOOL.version, draft: draftRecordsAnswer, reads: "Money records, latest first (Phase 4)" },
  EXPLAIN_PROFIT: { version: EXPLAIN_PROFIT_TOOL.version, draft: draftExplainProfitAnswer, reads: "Farm screen: recorded surplus and margin (Phase 8)" },
  COMPARE_SEASONS: { version: COMPARE_SEASONS_TOOL.version, draft: draftCompareSeasonsAnswer, reads: "Farm screen for the chosen season and the one before (Phase 8)" },
  SUMMARIZE: { version: SUMMARIZE_TOOL.version, draft: draftSummarizeAnswer, reads: "Farm screen: surplus, top enterprise, enterprises below zero (Phase 8)" },
  UNUSUAL_COSTS: { version: UNUSUAL_COSTS_TOOL.version, draft: draftUnusualCostsAnswer, reads: "Alerts: the approved cost rules (Phase 10)" },
  UPCOMING_TASKS: { version: UPCOMING_TASKS_TOOL.version, draft: draftUpcomingTasksAnswer, reads: "Activities due and missed (Phase 6)" },
  FARM_REPORT: { version: FARM_REPORT_TOOL.version, draft: draftFarmReportAnswer, reads: "Farm screen: totals, costs by kind, enterprise margins (Phase 8)" },
});

export const draftAnswer = (source: DraftSource): Answer => TOOLS[source.tool].draft(source);
