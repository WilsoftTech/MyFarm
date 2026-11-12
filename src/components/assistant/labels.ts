import type { StatementKind } from "@/modules/ai-assistant/domain/answer";
import type { ShownAnswer, ShownValue } from "@/modules/ai-assistant/domain/exchange";
import type { AssistantPeriod, ToolKey } from "@/modules/ai-assistant/domain/evidence";
import { formatMoney, formatNumber } from "@/components/accounting/labels";

/** R003: every statement says what kind of claim it is, in plain words. */
export const kindLabels: Record<StatementKind, string> = {
  FACT: "Fact from your records",
  INFERENCE: "What this suggests",
  RECOMMENDATION: "Suggestion",
  UNCERTAINTY: "Not certain",
};

export function periodText(period: AssistantPeriod): string {
  if (period.kind === "SEASON") return "season " + period.label;
  if (period.kind === "ALL_RECORDS") return "all records";
  if (period.from && period.to) return "the dates " + period.from + " to " + period.to;
  return period.from ? "records from " + period.from : "records up to " + period.to;
}

/** A placeholder's value as the farmer reads it. Amounts are only grouped for reading; no arithmetic happens here. */
export function valueText(value: ShownValue | undefined): string {
  if (!value) return "";
  if (value.kind === "MONEY") return formatMoney(value.amount, value.currency);
  if (value.kind === "LABEL") return value.text;
  if (value.kind === "PERIOD") return periodText(value.period);
  if (value.kind === "PERCENT") return value.value + "%";
  if (value.kind === "COUNT") return value.value.endsWith("+") ? formatNumber(value.value.slice(0, -1)) + " or more" : formatNumber(value.value);
  return value.value;
}

/** The whole statement as text, for tests and screen readers. */
export function statementText(answer: ShownAnswer, index: number): string {
  return answer.statements[index].parts.map(part => part.type === "TEXT" ? part.text : valueText(answer.values[part.ref])).join("");
}

export const basisText = { ACCRUAL: "counted when sold or bought", CASH: "counted when money moved" } as const;

/** R002 provenance in the farmer's words: which part of MyFarm each answer was worked out from. */
export const toolSources: Record<ToolKey, string> = {
  HIGHEST_PROFIT: "the money figures on the farm screen",
  EXPLAIN_PROFIT: "the money figures on the farm screen",
  SUMMARIZE: "the money figures on the farm screen",
  FARM_REPORT: "the money figures on the farm screen",
  COMPARE_SEASONS: "the money figures on the farm screen, for this season and the one before",
  ASK_RECORDS: "your money records",
  UNUSUAL_COSTS: "the farm's alerts, each over its own period",
  UPCOMING_TASKS: "your planned farm work",
};

/** Where to see the whole picture. A link is part of the page, never part of an answer (links in answers are refused). */
export function toolLink(tool: ToolKey, farmId: string): { href: string; text: string } | null {
  const base = "/farms/" + farmId;
  switch (tool) {
    case "ASK_RECORDS": return { href: base + "/accounting/records", text: "Open all money records" };
    case "UNUSUAL_COSTS": return { href: base + "/insights", text: "Open Alerts" };
    case "UPCOMING_TASKS": return { href: base + "/activities", text: "Open Activities" };
    case "FARM_REPORT": return { href: base + "/accounting/summary", text: "Open the money summary, where you can download it" };
    default: return { href: base + "/accounting/how-the-farm-is-doing", text: "Open the farm screen" };
  }
}

/** Shown under the question box: one plain example for each kind of question (R002). */
export const EXAMPLE_QUESTIONS = [
  "Which enterprise made me the most money?",
  "How much profit did I make?",
  "Compare this season with the last season",
  "Give me a summary of the farm",
  "Make me a farm report",
  "Are any costs unusual?",
  "What tasks are coming up?",
  "Show me my latest records",
] as const;
