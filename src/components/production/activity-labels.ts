import type { ActivityUnavailableReason } from "@/modules/farm-activities/contracts/catalog";
import { ACTIVITY_TIME_ZONE, type ActivityBucket } from "@/modules/farm-activities/domain/activity";
import type { RecurrenceFrequency } from "@/modules/farm-activities/domain/recurrence";

export const activityUnavailableLabels: Record<ActivityUnavailableReason, string> = {
  NO_MVP_WORKFLOW: "not available yet",
  ENTERPRISE_NOT_SUPPORTED: "not available for this enterprise yet",
  NOT_FOR_THIS_ENTERPRISE: "not for this enterprise",
};
export const activityBucketLabels: Record<ActivityBucket, string> = { TODAY: "Today", UPCOMING: "Upcoming", MISSED: "Missed", COMPLETED: "Completed", CANCELLED: "Cancelled" };
export const activityEmptyLabels: Record<ActivityBucket, string> = {
  TODAY: "Nothing is due today.", UPCOMING: "Nothing is scheduled ahead.", MISSED: "No missed activities.", COMPLETED: "No completed activities yet.", CANCELLED: "No cancelled activities.",
};
const time = new Intl.DateTimeFormat("en-GB", { timeZone: ACTIVITY_TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
export function activityTime(value: string): string { return time.format(new Date(value)) + " Kampala time"; }
const frequencyUnits: Record<RecurrenceFrequency, [string, string]> = { DAILY: ["day", "days"], WEEKLY: ["week", "weeks"], MONTHLY: ["month", "months"] };
export const recurrenceFrequencyChoices: { id: RecurrenceFrequency; label: string }[] = [{ id: "DAILY", label: "Days" }, { id: "WEEKLY", label: "Weeks" }, { id: "MONTHLY", label: "Months" }];
export function recurrencePattern(frequency: RecurrenceFrequency, interval: number): string {
  return interval === 1 ? "Every " + frequencyUnits[frequency][0] : "Every " + interval + " " + frequencyUnits[frequency][1];
}
