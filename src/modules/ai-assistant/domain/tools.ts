import type { Answer } from "./answer";
import { refOf, type Draft, type DraftSource, type ToolKey } from "./evidence";
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

/** R003 contradictory sources: the plain answer says what disagrees and states none of it as a fact. */
export function draftDisagreement(source: DraftSource): Answer {
  const expected = refOf(source, "CHECK_EXPECTED")!, found = refOf(source, "CHECK_FOUND")!;
  return { statements: [
    { kind: "UNCERTAINTY", text: `MyFarm's own checks do not add up for {P} in this currency: one way of adding the records gives {${expected}}, another gives {${found}}.`, refs: [expected, found] },
    { kind: "UNCERTAINTY", text: "Until this is put right, MyFarm gives none of these figures as a fact. The farm screen shows which check failed; please tell the MyFarm team.", refs: [] },
  ] };
}

export const draftAnswer = (source: DraftSource): Answer =>
  source.outcome.status === "NO_CONCLUSION" && source.outcome.reason === "SOURCES_DISAGREE" ? draftDisagreement(source) : TOOLS[source.tool].draft(source);
