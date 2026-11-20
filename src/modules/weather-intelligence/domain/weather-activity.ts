import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { assertSameFarm } from "@/modules/enterprises-seasons/domain/production";
import { ACTIVITY_TIME_ZONE, farmToday } from "@/modules/farm-activities/domain/activity";
import { ACTIVITY_LABELS } from "@/modules/farm-activities/domain/catalog";
import { weatherEvaluationSchema, type TestForecast, type WeatherActivity, type WeatherContext } from "../contracts/weather";

export type WeatherLimitation = "LOCATION_MISSING" | "TIME_ZONE_MISSING" | "CROP_MISSING" | "CROP_STAGE_MISSING" |
  "FORECAST_UNAVAILABLE" | "LOCATION_MISMATCH" | "FORECAST_NOT_ISSUED" | "FORECAST_EXPIRED" | "FORECAST_OUTSIDE_TASK_DATE" |
  "RAIN_UNKNOWN" | "ACTIVITY_CLOSED" | "ACTIVITY_IN_PAST" | "ACTIVITY_NOT_SPRAYING";
export interface WeatherActivityEvaluation {
  schemaVersion: 1;
  testOnly: true;
  rule: "TEST_RAIN_SPRAYING_V1";
  status: "TEST_NOTICE" | "NOT_ASSESSED" | "NO_MATCH";
  checkedAt: string;
  activity: Pick<WeatherActivity, "activityId" | "version" | "dueOn"> & { label: string };
  context: WeatherContext;
  forecast: TestForecast | null;
  limitations: WeatherLimitation[];
  message: string;
  /** Display intent only. There is no command, new date, confirmation or write handle in this contract. */
  nextAction: "REVIEW_TASK" | "NONE";
}

/** Pure, clock-injected test evaluation. Authorization/parent resolution belongs to the following service task. */
export function evaluateWeatherActivity(input: unknown, now: Date): WeatherActivityEvaluation {
  const parsed = weatherEvaluationSchema.safeParse(input);
  if (!parsed.success || !Number.isFinite(now.getTime())) throw new FoundationError("INVALID_INPUT");
  const { context, activity, forecast } = parsed.data;
  assertSameFarm(context, [activity]);
  const limitations: WeatherLimitation[] = [];
  if (!context.crop) limitations.push("CROP_MISSING");
  else if (!context.crop.stage) limitations.push("CROP_STAGE_MISSING");
  const base = {
    schemaVersion: 1 as const, testOnly: true as const, rule: "TEST_RAIN_SPRAYING_V1" as const,
    checkedAt: now.toISOString(), activity: { activityId: activity.activityId, version: activity.version, dueOn: activity.dueOn, label: ACTIVITY_LABELS[activity.type] },
    context, forecast: null, limitations,
  };
  const stop = (reason: WeatherLimitation): WeatherActivityEvaluation => ({ ...base, status: "NOT_ASSESSED", limitations: [...limitations, reason],
    message: "Test forecast only. This task could not be assessed; no conclusion about suitable weather can be made.", nextAction: "NONE" });
  if (!context.location) return stop("LOCATION_MISSING");
  if (!context.timeZone) return stop("TIME_ZONE_MISSING");
  if (activity.status !== "SCHEDULED") return stop("ACTIVITY_CLOSED");
  if (activity.dueOn < farmToday(now)) return stop("ACTIVITY_IN_PAST");
  if (activity.type !== "SPRAYING") return stop("ACTIVITY_NOT_SPRAYING");
  if (!forecast) return stop("FORECAST_UNAVAILABLE");
  if (forecast.locationKey !== context.location.key) return stop("LOCATION_MISMATCH");
  if (Date.parse(forecast.issuedAt) > now.getTime()) return stop("FORECAST_NOT_ISSUED");
  if (Date.parse(forecast.expiresAt) <= now.getTime() || Date.parse(forecast.validTo) <= now.getTime()) return stop("FORECAST_EXPIRED");
  // Half-open provider windows; use the existing farm calendar, never the machine's local timezone.
  const firstDay = farmToday(new Date(forecast.validFrom));
  const lastDay = farmToday(new Date(Date.parse(forecast.validTo) - 1));
  if (activity.dueOn < firstDay || activity.dueOn > lastDay) return stop("FORECAST_OUTSIDE_TASK_DATE");
  if (forecast.rain === "UNKNOWN") return stop("RAIN_UNKNOWN");
  if (forecast.rain === "NOT_EXPECTED") return { ...base, forecast, status: "NO_MATCH", nextAction: "NONE",
    message: "Test forecast only. No rain signal matches this task; this does not establish that spraying is suitable." };
  return { ...base, forecast, status: "TEST_NOTICE", nextAction: "REVIEW_TASK",
    message: `Test forecast: rain is expected during the forecast window for Spraying on ${activity.dueOn} (${ACTIVITY_TIME_ZONE}). The activity may need rescheduling. Review it before making any change. This is not live agronomic advice.` };
}
