import { describe, expect, it } from "vitest";
import { testForecastSchema, weatherContextSchema, type TestForecast, type WeatherActivity, type WeatherContext } from "@/modules/weather-intelligence/contracts/weather";
import { evaluateWeatherActivity } from "@/modules/weather-intelligence/domain/weather-activity";

const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-11-20T09:00:00.000Z");
const context: WeatherContext = { tenantId: id(1), farmId: id(2), timeZone: "Africa/Kampala", location: { key: "test-district", label: "Test district", precision: "APPROXIMATE" },
  crop: { cycleId: id(3), label: "Beans", stage: "Flowering", stageSource: "FARMER" } };
const activity: WeatherActivity = { tenantId: id(1), farmId: id(2), activityId: id(4), type: "SPRAYING", dueOn: "2026-11-21", status: "SCHEDULED", version: 3 };
const forecast: TestForecast = { schemaVersion: 1, source: "TEST_FIXTURE", forecastId: id(5), provider: "synthetic", locationKey: "test-district", rain: "EXPECTED",
  issuedAt: "2026-11-20T06:00:00.000Z", validFrom: "2026-11-20T21:00:00.000Z", validTo: "2026-11-21T21:00:00.000Z", expiresAt: "2026-11-20T12:00:00.000Z" };
const evaluate = (overrides: { context?: WeatherContext; activity?: WeatherActivity; forecast?: TestForecast | null } = {}, clock = now) => evaluateWeatherActivity({ context, activity, forecast, ...overrides }, clock);

describe("Phase 13 T001: contextual synthetic weather (P0697)", () => {
  it("names the spraying task/date with forecast provenance, approximate location and farmer-entered stage, without changing the task", () => {
    const before = JSON.stringify({ context, activity, forecast });
    const result = evaluate();
    expect(result).toMatchObject({ testOnly: true, rule: "TEST_RAIN_SPRAYING_V1", status: "TEST_NOTICE", nextAction: "REVIEW_TASK", limitations: [],
      activity: { activityId: id(4), version: 3, dueOn: "2026-11-21", label: "Spraying" }, context, forecast });
    expect(result.message).toContain("may need rescheduling");
    expect(result.message).toContain("2026-11-21 (Africa/Kampala)");
    expect(result.message).toContain("not live agronomic advice");
    expect(JSON.stringify({ context, activity, forecast })).toBe(before);
    expect(result).not.toHaveProperty("command");
  });
  it("keeps a general task notice when stage or crop is missing, never inventing either", () => {
    expect(evaluate({ context: { ...context, crop: { cycleId: id(3), label: "Beans", stage: null, stageSource: "FARMER" } } })).toMatchObject({ status: "TEST_NOTICE", limitations: ["CROP_STAGE_MISSING"], context: { crop: { stage: null } } });
    expect(evaluate({ context: { ...context, crop: null } })).toMatchObject({ status: "TEST_NOTICE", limitations: ["CROP_MISSING"], context: { crop: null } });
  });
  it.each(["location", "timeZone"] as const)("does not guess missing %s or require GPS", key => {
    const result = evaluate({ context: { ...context, [key]: null } });
    expect(result.status).toBe("NOT_ASSESSED");
    expect(result.limitations).toContain(key === "location" ? "LOCATION_MISSING" : "TIME_ZONE_MISSING");
    expect(result.forecast).toBeNull();
  });
  it("refuses another place's forecast and never presents it as evidence", () => {
    expect(evaluate({ forecast: { ...forecast, locationKey: "another-district" } })).toMatchObject({ status: "NOT_ASSESSED", forecast: null, limitations: ["LOCATION_MISMATCH"] });
  });
  it("expires at the exact boundary, refuses future issues and handles provider unavailability explicitly", () => {
    expect(evaluate({}, new Date("2026-11-20T11:59:59.999Z")).status).toBe("TEST_NOTICE");
    expect(evaluate({}, new Date(forecast.expiresAt))).toMatchObject({ status: "NOT_ASSESSED", limitations: ["FORECAST_EXPIRED"] });
    expect(evaluate({}, new Date("2026-11-20T05:59:59.999Z")).limitations).toContain("FORECAST_NOT_ISSUED");
    expect(evaluate({ forecast: null }).limitations).toContain("FORECAST_UNAVAILABLE");
  });
  it("uses Kampala dates and half-open forecast windows at midnight", () => {
    expect(evaluate({ forecast: { ...forecast, validTo: "2026-11-20T21:00:00.000Z", validFrom: "2026-11-20T06:00:00.000Z" } }).limitations).toContain("FORECAST_OUTSIDE_TASK_DATE");
    expect(evaluate({ activity: { ...activity, dueOn: "2026-11-20" } }).limitations).toContain("FORECAST_OUTSIDE_TASK_DATE");
    expect(evaluate().status).toBe("TEST_NOTICE");
  });
  it("does not interpret an absent rain signal as safe spraying", () => {
    expect(evaluate({ forecast: { ...forecast, rain: "UNKNOWN" } }).limitations).toContain("RAIN_UNKNOWN");
    const result = evaluate({ forecast: { ...forecast, rain: "NOT_EXPECTED" } });
    expect(result.status).toBe("NO_MATCH");
    expect(result.message).toContain("does not establish");
    expect(result.nextAction).toBe("NONE");
  });
  it.each(["COMPLETED", "CANCELLED"] as const)("does not assess %s work", status => {
    expect(evaluate({ activity: { ...activity, status } }).limitations).toContain("ACTIVITY_CLOSED");
  });
  it("does not infer weather rules for other tasks or overdue work", () => {
    expect(evaluate({ activity: { ...activity, type: "IRRIGATION" } }).limitations).toContain("ACTIVITY_NOT_SPRAYING");
    expect(evaluate({ activity: { ...activity, dueOn: "2026-11-19" } }).limitations).toContain("ACTIVITY_IN_PAST");
  });
  it.each(["tenantId", "farmId"] as const)("refuses a mismatched %s before evaluating", key => {
    expect(() => evaluate({ activity: { ...activity, [key]: id(99) } })).toThrow("FORBIDDEN");
  });
  it("rejects malformed dates, units, scope fields and purported live forecasts", () => {
    for (const change of [{ provider: "live" }, { source: "LIVE" }, { rain: "100mm" }, { issuedAt: "2026-02-30T00:00:00Z" }, { expiresAt: forecast.issuedAt }, { validTo: forecast.validFrom }, { latitude: 0 }, { actorId: id(9) }, { confirmed: true }]) {
      expect(testForecastSchema.safeParse({ ...forecast, ...change }).success).toBe(false);
    }
    expect(weatherContextSchema.safeParse({ ...context, timeZone: "UTC" }).success).toBe(false);
    expect(() => evaluateWeatherActivity({ context, activity: { ...activity, dueOn: "2026-02-30" }, forecast }, now)).toThrow("INVALID_INPUT");
    expect(() => evaluate({}, new Date("invalid"))).toThrow("INVALID_INPUT");
  });
});
