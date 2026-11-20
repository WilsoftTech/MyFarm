import { describe, expect, it } from "vitest";
import { testWeatherNotices } from "@/modules/weather-intelligence/domain/notices";
import { testForecastAdapter } from "@/modules/weather-intelligence/infrastructure/test-adapter";
import { testForecastSchema } from "@/modules/weather-intelligence/contracts/weather";
import { weatherConfirmationSchema } from "@/modules/weather-intelligence/contracts/service";
const now = new Date("2026-11-20T09:00:00Z");
describe("six synthetic weather capabilities, not agronomic thresholds", () => {
  it.each(["RAIN", "PLANTING", "IRRIGATION", "EXTREME", "NONE"] as const)("evaluates %s with provenance and six bounded notices", async scenario => {
    const forecast = testForecastSchema.parse(await testForecastAdapter(scenario, () => now).fetch("test-place", new AbortController().signal));
    const notices = testWeatherNotices(forecast, now);
    expect(notices).toHaveLength(6); expect(new Set(notices.map(n => n.key)).size).toBe(6);
    expect(notices.every(n => /test|synthetic/i.test(n.message))).toBe(true);
    expect(notices.find(n => n.key === "RAIN")?.status).toBe(scenario === "RAIN" ? "TEST_SIGNAL" : "NO_SIGNAL");
    expect(notices.find(n => n.key === "SPRAYING")?.status).toBe(scenario === "RAIN" ? "TEST_SIGNAL" : "NO_SIGNAL");
    for (const key of ["PLANTING", "IRRIGATION", "EXTREME"]) expect(notices.find(n => n.key === key)?.status).toBe(scenario === key ? "TEST_SIGNAL" : "NO_SIGNAL");
    expect(testWeatherNotices(forecast, new Date(forecast.expiresAt)).every(n => n.status === "UNAVAILABLE")).toBe(true);
  });
  it("never invents weather when a provider fails", () => {
    expect(testWeatherNotices(null, now).every(n => n.status === "UNAVAILABLE")).toBe(true);
  });
  it("rejects a confirmation without exact consent", () => {
    for (const confirmed of [false, "yes", 1, null, undefined]) expect(weatherConfirmationSchema.safeParse({ confirmed }).success).toBe(false);
  });
});
