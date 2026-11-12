import type { StatementKind } from "@/modules/ai-assistant/domain/answer";
import type { ShownAnswer, ShownValue } from "@/modules/ai-assistant/domain/exchange";
import type { AssistantPeriod } from "@/modules/ai-assistant/domain/evidence";
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
