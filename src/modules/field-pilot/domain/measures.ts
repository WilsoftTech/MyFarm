import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { percentString, ratioString } from "@/modules/analytics-profitability/domain/metric";

/**
 * Pilot measures (R001, D-P09-002 to D-P09-004, D-P09-008, D-P09-009). Every count comes from a server receipt or
 * a log row that is unique per request, and is deduplicated again here, so a retried entry counts once. Weeks run
 * from the cohort's start in farm days. A withdrawn farmer is left out of everything.
 */

/** Receipts that mean the farmer saved a record. Setup, reversals and photos are not records. */
export const RECORD_ACTIONS = [
  "ACCOUNTING_EXPENSE_RECORDED", "ACCOUNTING_INCOME_RECORDED", "ACCOUNTING_SALE_RECORDED", "ACCOUNTING_PURCHASE_RECORDED", "ACCOUNTING_PAYMENT_RECORDED",
  "HARVEST_RECORDED", "STOCK_OPERATION_POSTED", "POULTRY_PRODUCTION_RECORDED",
  "ACTIVITY_SCHEDULED", "ACTIVITY_RECORDED_DONE", "ACTIVITY_COMPLETED",
] as const;
export const EXPENSE_ACTIONS = ["ACCOUNTING_EXPENSE_RECORDED", "ACCOUNTING_PURCHASE_RECORDED"] as const;
export const HARVEST_ACTIONS = ["HARVEST_RECORDED"] as const;
export const TASK_ACTIONS = ["ACTIVITY_COMPLETED", "ACTIVITY_RECORDED_DONE"] as const;
export const CYCLE_CLOSED_ACTIONS = ["CROP_CYCLE_CLOSED", "POULTRY_BATCH_CLOSED"] as const;
/** Every receipt the measures read; nothing else is fetched. */
export const MEASURED_ACTIONS: readonly string[] = [...new Set<string>([...RECORD_ACTIONS, ...CYCLE_CLOSED_ACTIONS])];

export const USAGE_KINDS = ["OFFLINE_COMMITTED", "SYNC_REFUSED"] as const;
export type UsageKind = typeof USAGE_KINDS[number];
export const SUPPORT_SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type SupportSeverity = typeof SUPPORT_SEVERITIES[number];

/** D-P09-003: active in at least 3 of the last 4 weeks. D-P09-004: the gate is half retained at week 8. */
export const RETENTION_WINDOW = 4, RETENTION_NEEDED = 3, GATE_WEEK = 8, GATE_SHARE_PERCENT = 50n;

/** A share or rate, or why it cannot be worked out. Never a 0 standing in for "no farmers yet". */
export type PilotValue = { status: "AVAILABLE"; value: string } | { status: "UNAVAILABLE"; reason: "NO_FARMERS" | "NO_PHONE_ENTRIES" };
const value = (text: string): PilotValue => ({ status: "AVAILABLE", value: text });
const none = (reason: "NO_FARMERS" | "NO_PHONE_ENTRIES"): PilotValue => ({ status: "UNAVAILABLE", reason });

export interface PilotWindow { startOn: string; endOn: string }
export interface Participant { participationId: string; userId: string; pseudonym: string; status: "ENROLLED" | "WITHDRAWN"; enrolledOn: string }
/** A receipt, or a usage log row: unique by tenant, request and action or kind. `day` is the farm day it happened. */
export interface ReceiptFact { tenantId: string; requestId: string; actorId: string; action: string; day: string }
export interface UsageFact { tenantId: string; requestId: string; actorId: string; kind: UsageKind; day: string }
export interface PromptFact { participationId: string; day: string }
export interface IncidentFact { participationId: string | null; openedOn: string; severity: SupportSeverity; status: "OPEN" | "RESOLVED" }
export interface PilotFacts { window: PilotWindow; today: string; participants: Participant[]; receipts: ReceiptFact[]; usage: UsageFact[]; prompts: PromptFact[]; incidents: IncidentFact[] }

const DAY = 86_400_000;
const dayNumber = (day: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new FoundationError("INVALID_INPUT");
  const value = Date.parse(day + "T00:00:00Z");
  if (Number.isNaN(value)) throw new FoundationError("INVALID_INPUT");
  return value / DAY;
};
/** Week 1 is the cohort's first seven days. A day before the start has no week. */
export function weekOf(window: PilotWindow, day: string): number | null {
  const offset = dayNumber(day) - dayNumber(window.startOn);
  return offset < 0 ? null : Math.floor(offset / 7) + 1;
}

export interface ParticipantWeek { week: number; records: number; prompted: boolean; active: boolean; voluntary: boolean; retained: boolean | null }
export interface ParticipantSeries { participationId: string; pseudonym: string; joinedWeek: number; weeks: ParticipantWeek[] }
export interface WeekMeasures {
  week: number;
  /** The week has not ended yet, so its figures can still change. */
  soFar: boolean;
  joined: number;
  activeFarmers: number;
  records: number;
  recordsPerFarmer: PilotValue;
  /** Retained voluntarily in this week ÷ farmers onboarded (measure 2). */
  retainedVoluntarily: number;
  retainedShare: PilotValue;
}
export interface GateCheck { week: number; retainedVoluntarily: number; onboarded: number; met: boolean }
export interface PilotMeasures {
  window: PilotWindow;
  /** The last week with any day on or before today, within the window. */
  currentWeek: number;
  onboarded: number;
  weeks: WeekMeasures[];
  expensesRecorded: number;
  harvestsRecorded: number;
  tasksCompleted: number;
  offlineTransactions: number;
  syncFailures: number;
  /** Refused ÷ (committed from phones + refused). Attempts that never reached the server are not seen (D-P09-008). */
  syncFailureShare: PilotValue;
  support: { total: number; open: number; bySeverity: Record<SupportSeverity, number> };
  farmersCompletingCycle: number;
  completingCycleShare: PilotValue;
  /** D-P09-004: at week 8 and again at the window's last week; each is null until that week has ended. */
  gates: { atWeek8: GateCheck | null; atEnd: GateCheck | null };
  participants: ParticipantSeries[];
}

function unique<T>(rows: readonly T[], key: (row: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) if (!seen.has(key(row))) seen.set(key(row), row);
  return [...seen.values()];
}
const share = (part: number, whole: number, reason: "NO_FARMERS" | "NO_PHONE_ENTRIES" = "NO_FARMERS") => whole === 0 ? none(reason) : value(percentString(BigInt(part), BigInt(whole)));

/**
 * The ten measures for a cohort as of `today`. Only receipts of joined (not withdrawn) farmers inside the window
 * count; a record before a farmer joined does not count for the pilot.
 */
export function pilotMeasures(facts: PilotFacts): PilotMeasures {
  const { window, today } = facts;
  if (dayNumber(window.endOn) < dayNumber(window.startOn)) throw new FoundationError("INVALID_INPUT");
  const lastDay = today < window.endOn ? today : window.endOn;
  const currentWeek = Math.max(0, weekOf(window, lastDay) ?? 0);
  const finalWeek = weekOf(window, window.endOn) ?? 0;
  const weekEnded = (week: number) => week < (weekOf(window, today) ?? 0) || today > window.endOn;

  const joined = facts.participants.filter(row => row.status === "ENROLLED");
  const byUser = new Map(joined.map(row => [row.userId, row]));
  const inPilot = (actorId: string, day: string) => {
    const participant = byUser.get(actorId);
    return Boolean(participant) && day >= participant!.enrolledOn && day >= window.startOn && day <= window.endOn && day <= today;
  };
  const receipts = unique(facts.receipts, row => row.tenantId + "|" + row.requestId + "|" + row.action).filter(row => inPilot(row.actorId, row.day));
  const usage = unique(facts.usage, row => row.tenantId + "|" + row.requestId + "|" + row.kind).filter(row => inPilot(row.actorId, row.day));
  const records = receipts.filter(row => (RECORD_ACTIONS as readonly string[]).includes(row.action));
  const count = (actions: readonly string[]) => receipts.filter(row => actions.includes(row.action)).length;

  const prompted = new Set(facts.prompts.map(row => row.participationId + "|" + weekOf(window, row.day)));
  const participants: ParticipantSeries[] = joined.map(participant => {
    const joinedWeek = Math.max(1, weekOf(window, participant.enrolledOn) ?? 1);
    const weeks: ParticipantWeek[] = [];
    for (let week = joinedWeek; week <= currentWeek; week++) {
      const saved = records.filter(row => row.actorId === participant.userId && weekOf(window, row.day) === week).length;
      const wasPrompted = prompted.has(participant.participationId + "|" + week);
      const voluntary = saved > 0 && !wasPrompted;
      const recent = week - RETENTION_WINDOW + 1 >= joinedWeek ? weeks.slice(-(RETENTION_WINDOW - 1)).filter(row => row.voluntary).length + (voluntary ? 1 : 0) : null;
      weeks.push({ week, records: saved, prompted: wasPrompted, active: saved > 0, voluntary, retained: recent === null ? null : recent >= RETENTION_NEEDED });
    }
    return { participationId: participant.participationId, pseudonym: participant.pseudonym, joinedWeek, weeks };
  }).sort((a, b) => a.pseudonym.localeCompare(b.pseudonym, undefined, { numeric: true }));

  const onboarded = joined.length;
  const weeks: WeekMeasures[] = [];
  for (let week = 1; week <= currentWeek; week++) {
    const rows = participants.flatMap(series => series.weeks.filter(row => row.week === week));
    const saved = rows.reduce((total, row) => total + row.records, 0);
    const retained = rows.filter(row => row.retained === true).length;
    weeks.push({
      week, soFar: !weekEnded(week), joined: rows.length, activeFarmers: rows.filter(row => row.active).length, records: saved,
      recordsPerFarmer: rows.length === 0 ? none("NO_FARMERS") : value(ratioString(BigInt(saved), BigInt(rows.length), 2)),
      retainedVoluntarily: retained, retainedShare: share(retained, onboarded),
    });
  }

  const offline = usage.filter(row => row.kind === "OFFLINE_COMMITTED").length, refused = usage.filter(row => row.kind === "SYNC_REFUSED").length;
  const incidents = facts.incidents.filter(row => row.openedOn >= window.startOn && row.openedOn <= lastDay && (row.participationId === null || joined.some(p => p.participationId === row.participationId)));
  const bySeverity = Object.fromEntries(SUPPORT_SEVERITIES.map(level => [level, incidents.filter(row => row.severity === level).length])) as Record<SupportSeverity, number>;
  const completing = new Set(receipts.filter(row => (CYCLE_CLOSED_ACTIONS as readonly string[]).includes(row.action)).map(row => row.actorId)).size;
  const gateAt = (week: number): GateCheck | null => {
    const row = weeks.find(line => line.week === week);
    return row && weekEnded(week) ? { week, retainedVoluntarily: row.retainedVoluntarily, onboarded, met: onboarded > 0 && BigInt(row.retainedVoluntarily) * 100n >= GATE_SHARE_PERCENT * BigInt(onboarded) } : null;
  };

  return {
    window, currentWeek, onboarded, weeks,
    expensesRecorded: count(EXPENSE_ACTIONS), harvestsRecorded: count(HARVEST_ACTIONS), tasksCompleted: count(TASK_ACTIONS),
    offlineTransactions: offline, syncFailures: refused, syncFailureShare: share(refused, offline + refused, "NO_PHONE_ENTRIES"),
    support: { total: incidents.length, open: incidents.filter(row => row.status === "OPEN").length, bySeverity },
    farmersCompletingCycle: completing, completingCycleShare: share(completing, onboarded),
    gates: { atWeek8: gateAt(Math.min(GATE_WEEK, finalWeek)), atEnd: gateAt(finalWeek) }, participants,
  };
}
