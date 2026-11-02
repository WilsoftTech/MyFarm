import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { ActivityType } from "./catalog";

export const RECURRENCE_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RecurrenceFrequency = typeof RECURRENCE_FREQUENCIES[number];
/** Source P0429-P0433. */
export const RECURRING_ACTIVITY_TYPES: readonly ActivityType[] = Object.freeze(["FEEDING", "MILKING", "CLEANING", "VACCINATION", "INSPECTION"] as const);
/** D-P06-003: generated about 30 days ahead. */
export const RECURRENCE_HORIZON_DAYS = 30;
/** Bounds one expansion transaction. A long-unopened daily series catches up over later calls. */
export const MAX_DATES_PER_EXPANSION = 400;

export interface RecurrenceRule { frequency: RecurrenceFrequency; interval: number; startOn: string; endOn: string | null; stoppedFrom: string | null }

const toUtc = (date: string) => { const [year, month, day] = date.split("-").map(Number); return { year, month, day }; };
const format = (value: Date) => value.toISOString().slice(0, 10);
export function addDays(date: string, days: number): string {
  const { year, month, day } = toUtc(date);
  return format(new Date(Date.UTC(year, month - 1, day + days)));
}
/** Always counted from the start date, so 31 Jan gives 28 Feb then 31 Mar rather than drifting to the 28th. */
function monthlyDate(startOn: string, months: number): string {
  const { year, month, day } = toUtc(startOn);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  return format(new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))));
}
const stepDays = (rule: RecurrenceRule) => rule.frequency === "DAILY" ? rule.interval : rule.interval * 7;
function dateAt(rule: RecurrenceRule, index: number): string {
  return rule.frequency === "MONTHLY" ? monthlyDate(rule.startOn, index * rule.interval) : addDays(rule.startOn, index * stepDays(rule));
}
const dayNumber = (date: string) => { const { year, month, day } = toUtc(date); return Date.UTC(year, month - 1, day) / 86_400_000; };

/** Due dates within from..through, never past the end date or at/after a stop date. Deterministic and repeatable. */
export function occurrenceDates(rule: RecurrenceRule, from: string, through: string, limit = MAX_DATES_PER_EXPANSION): string[] {
  const first = from > rule.startOn ? from : rule.startOn;
  const elapsed = Math.max(0, dayNumber(first) - dayNumber(rule.startOn));
  // Start just before the window so a series far from its start date does not walk its whole history.
  let index = rule.frequency === "MONTHLY" ? Math.max(0, Math.floor(elapsed / 31 / rule.interval) - 1) : Math.floor(elapsed / stepDays(rule));
  const dates: string[] = [];
  while (dates.length < limit) {
    const date = dateAt(rule, index++);
    if (date > through || (rule.endOn && date > rule.endOn) || (rule.stoppedFrom && date >= rule.stoppedFrom)) break;
    if (date >= first) dates.push(date);
  }
  return dates;
}

/** The next dates to generate, and how far the series may then be marked as generated. */
export function expansionPlan(rule: RecurrenceRule, expandedThrough: string | null, today: string): { dates: string[]; expandedThrough: string } {
  const horizon = addDays(today, RECURRENCE_HORIZON_DAYS);
  const dates = occurrenceDates(rule, expandedThrough ? addDays(expandedThrough, 1) : rule.startOn, horizon);
  return { dates, expandedThrough: dates.length === MAX_DATES_PER_EXPANSION ? dates[dates.length - 1] : horizon };
}

export function assertRecurringType(type: ActivityType): void {
  if (!RECURRING_ACTIVITY_TYPES.includes(type)) throw new FoundationError("INVALID_INPUT");
}
/** A series and its changes start today or later, so generating one never creates instant missed work. */
export function assertNotInPast(date: string, today: string): void {
  if (date < today) throw new FoundationError("INVALID_INPUT");
}
