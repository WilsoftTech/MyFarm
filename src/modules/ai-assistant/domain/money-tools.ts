import type { CostGroupTotals } from "@/modules/analytics-profitability/domain/metrics";
import type { Answer, Statement } from "./answer";
import { detailFlag, detailRefs, EvidenceBuilder, refOf, type DraftSource, type Evidence } from "./evidence";
import { byCurrency, enterpriseFigures, GROSS_MARGIN_MEANING, leftOutStatement, moneyBase, noRecords, notLinkedStatement, signedUnits, type MoneyViewInput } from "./highest-profit";

/**
 * MYF-P11-R002 tools that read the farm screen (Phase 8, D-P08-008): explain the recorded surplus, summarize the farm
 * and give a farm report. Every figure is the farm screen's own; nothing is added up here.
 */
export const EXPLAIN_PROFIT_TOOL = Object.freeze({ key: "EXPLAIN_PROFIT" as const, version: 1 });
export const SUMMARIZE_TOOL = Object.freeze({ key: "SUMMARIZE" as const, version: 1 });
export const FARM_REPORT_TOOL = Object.freeze({ key: "FARM_REPORT" as const, version: 1 });

/** A report fits one answer: totals, costs by kind, these enterprises and its notes stay within MAX_STATEMENTS. */
export const MAX_REPORT_ENTERPRISES = 5;

export const SURPLUS_MEANING = "This is the recorded surplus: money earned less money spent in your records. It is not your full profit: wear on tools and equipment and the cost of loans are not recorded, and stock not yet sold is not counted.";

function totals(build: EvidenceBuilder, row: MoneyViewInput["currencies"][number]) {
  return { revenue: build.money("REVENUE", row.revenue, row.currency), expenses: build.money("EXPENSES", row.expenses, row.currency), surplus: build.money("SURPLUS", row.recordedSurplus, row.currency) };
}

export function explainProfitEvidence(input: MoneyViewInput): Evidence[] {
  const { key, version } = EXPLAIN_PROFIT_TOOL;
  if (input.currencies.length === 0) return [noRecords(input, key, version)];
  return byCurrency(input).map(row => {
    const build = new EvidenceBuilder();
    const { surplus } = totals(build, row);
    if (row.surplusMargin.status === "AVAILABLE") build.figure("SURPLUS_MARGIN", "PERCENT", row.surplusMargin.value);
    return { ...moneyBase(input, key, version), currency: row.currency, outcome: { status: "ANSWERED", conclusion: [surplus], detail: { loss: signedUnits(row.recordedSurplus) < 0n } }, figures: build.figures, labels: build.labels, leftOut: 0 };
  });
}

export function summarizeEvidence(input: MoneyViewInput): Evidence[] {
  const { key, version } = SUMMARIZE_TOOL;
  if (input.currencies.length === 0) return [noRecords(input, key, version)];
  return byCurrency(input).map(row => {
    const build = new EvidenceBuilder();
    const { surplus } = totals(build, row);
    const tops = new Set(row.topEnterpriseIds);
    const top = row.enterprises.find(line => tops.has(line.enterpriseId));
    const leaders: string[] = [];
    if (top) {
      const ref = build.label("ENTERPRISE", top.name, top.enterpriseId);
      build.money("GROSS_MARGIN", top.grossMargin, row.currency, ref);
      leaders.push(ref);
    }
    build.figure("ENTERPRISES", "COUNT", String(row.enterprises.length));
    build.figure("ENTERPRISES_LOSING", "COUNT", String(row.enterprises.filter(line => signedUnits(line.grossMargin) < 0n).length));
    return { ...moneyBase(input, key, version), currency: row.currency, outcome: { status: "ANSWERED", conclusion: [surplus], detail: { leaders, tied: row.topEnterpriseIds.length > 1 } }, figures: build.figures, labels: build.labels, leftOut: 0 };
  });
}

export interface FarmReportInput extends MoneyViewInput { costGroups: readonly CostGroupTotals[] }

export function farmReportEvidence(input: FarmReportInput): Evidence[] {
  const { key, version } = FARM_REPORT_TOOL;
  if (input.currencies.length === 0) return [noRecords(input, key, version)];
  return byCurrency(input).map(row => {
    const build = new EvidenceBuilder();
    const { surplus } = totals(build, row);
    const groups = input.costGroups.find(group => group.currency === row.currency);
    if (groups) { build.money("LABOUR_COSTS", groups.labour, row.currency); build.money("INPUT_COSTS", groups.inputs, row.currency); build.money("OTHER_COSTS", groups.other, row.currency); }
    const { refs, leftOut } = enterpriseFigures(build, row, ["GROSS_MARGIN"], MAX_REPORT_ENTERPRISES);
    if (signedUnits(row.unassigned.revenue) > 0n) build.money("NOT_LINKED_REVENUE", row.unassigned.revenue, row.currency);
    if (signedUnits(row.unassigned.costs) > 0n) build.money("NOT_LINKED_COSTS", row.unassigned.costs, row.currency);
    return { ...moneyBase(input, key, version), currency: row.currency, outcome: { status: "ANSWERED", conclusion: [surplus], detail: { enterprises: refs } }, figures: build.figures, labels: build.labels, leftOut };
  });
}

const noMoney = (what: string): Answer => ({ statements: [{ kind: "UNCERTAINTY", text: `There are no money records for {P}, so MyFarm cannot ${what}.`, refs: [] }] });
function totalsStatement(source: DraftSource): Statement {
  const revenue = refOf(source, "REVENUE")!, expenses = refOf(source, "EXPENSES")!, surplus = refOf(source, "SURPLUS")!;
  return { kind: "FACT", text: `For {P}, money earned was {${revenue}} and money spent was {${expenses}}, so the recorded surplus is {${surplus}}.`, refs: [surplus, revenue, expenses] };
}

export function draftExplainProfitAnswer(source: DraftSource): Answer {
  if (source.outcome.status === "NO_CONCLUSION") return noMoney("work out a surplus");
  const statements: Statement[] = [totalsStatement(source)];
  const margin = refOf(source, "SURPLUS_MARGIN");
  if (margin) statements.push({ kind: "FACT", text: `The surplus is {${margin}} of the money earned.`, refs: [margin] });
  if (detailFlag(source.outcome, "loss")) statements.push({ kind: "INFERENCE", text: `More money went out than came in for {P}, going by these records: {${refOf(source, "SURPLUS")}}.`, refs: [refOf(source, "SURPLUS")!] });
  statements.push({ kind: "UNCERTAINTY", text: SURPLUS_MEANING, refs: [] });
  return { statements };
}

export function draftSummarizeAnswer(source: DraftSource): Answer {
  if (source.outcome.status === "NO_CONCLUSION") return noMoney("summarize the farm");
  const statements: Statement[] = [totalsStatement(source)];
  const [top] = detailRefs(source.outcome, "leaders");
  if (top) {
    const margin = refOf(source, "GROSS_MARGIN", top)!;
    statements.push({ kind: "FACT", text: detailFlag(source.outcome, "tied") ? `{${top}} was one of the enterprises tied for the highest gross margin: {${margin}}.` : `{${top}} had the highest gross margin: {${margin}}.`, refs: [margin, top] });
  }
  const all = refOf(source, "ENTERPRISES")!, losing = refOf(source, "ENTERPRISES_LOSING")!;
  statements.push({ kind: "FACT", text: `Enterprises with money records: {${all}}. Of those, enterprises with a gross margin below zero: {${losing}}.`, refs: [all, losing] });
  statements.push({ kind: "UNCERTAINTY", text: SURPLUS_MEANING, refs: [] });
  return { statements };
}

export function draftFarmReportAnswer(source: DraftSource): Answer {
  if (source.outcome.status === "NO_CONCLUSION") return noMoney("make a report");
  const statements: Statement[] = [totalsStatement(source)];
  const labour = refOf(source, "LABOUR_COSTS"), inputs = refOf(source, "INPUT_COSTS"), other = refOf(source, "OTHER_COSTS");
  if (labour && inputs && other) statements.push({ kind: "FACT", text: `Money spent by kind: labour {${labour}}, inputs {${inputs}}, other {${other}}.`, refs: [labour, inputs, other] });
  for (const ref of detailRefs(source.outcome, "enterprises")) {
    const margin = refOf(source, "GROSS_MARGIN", ref)!;
    statements.push({ kind: "FACT", text: `{${ref}}: gross margin {${margin}}.`, refs: [margin, ref] });
  }
  statements.push(...notLinkedStatement(source), ...leftOutStatement(source, "Only the enterprises with the highest gross margins are listed here."));
  statements.push({ kind: "UNCERTAINTY", text: GROSS_MARGIN_MEANING, refs: [] });
  // The assistant never makes files: downloads keep their own limits and audit (D-P04-010, D-P09-013).
  statements.push({ kind: "UNCERTAINTY", text: "The assistant does not make files. To download your records, use the money summary or the full farm export on the farm's own pages.", refs: [] });
  return { statements };
}
