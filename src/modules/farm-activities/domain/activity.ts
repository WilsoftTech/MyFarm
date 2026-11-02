import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { assertSameFarm, type FarmScope } from "@/modules/enterprises-seasons/domain/production";

/** D-P06-002: one farm calendar for the launch market; no per-farm timezone in Phase 6. */
export const ACTIVITY_TIME_ZONE = "Africa/Kampala";
export type ActivityStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export const ACTIVITY_BUCKETS = ["TODAY", "UPCOMING", "MISSED", "COMPLETED", "CANCELLED"] as const;
export type ActivityBucket = typeof ACTIVITY_BUCKETS[number];

const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: ACTIVITY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function farmToday(now: Date): string {
  const part = (type: string) => dateParts.formatToParts(now).find(value => value.type === type)?.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}

/** Calendar dates compare correctly as YYYY-MM-DD text, so no time zone conversion is involved. */
export function activityState(status: ActivityStatus, dueOn: string, today: string): ActivityBucket {
  if (status !== "SCHEDULED") return status;
  return dueOn === today ? "TODAY" : dueOn > today ? "UPCOMING" : "MISSED";
}

/** A missed activity is still SCHEDULED, so it can be completed late. Finished records never change. */
export function assertActivityOpen(activity: { status: ActivityStatus; version: number }, expectedVersion: number): void {
  if (activity.status !== "SCHEDULED" || activity.version !== expectedVersion) throw new FoundationError("CONFLICT");
}

/** D-P06-005: an activity may point at a posted expense or purchase on its own farm, and holds no money itself. */
export interface ActivityCostSource extends FarmScope { kind: string; status: string }
export function assertLinkableCost(scope: FarmScope, record: ActivityCostSource): void {
  assertSameFarm(scope, [record]);
  if (record.kind !== "EXPENSE" && record.kind !== "PURCHASE") throw new FoundationError("INVALID_INPUT");
  if (record.status !== "POSTED") throw new FoundationError("CONFLICT");
}
