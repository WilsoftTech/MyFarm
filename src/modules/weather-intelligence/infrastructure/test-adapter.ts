import "server-only";
import { createHash } from "node:crypto";
import type { TestForecastAdapter } from "../contracts/weather";
import type { WeatherRequest } from "../contracts/service";
/** Fifteen-minute synthetic fixture epochs, not a live-provider freshness policy. No network or storage. */
export function testForecastAdapter(scenario: WeatherRequest["scenario"], now: () => Date): TestForecastAdapter {
  return { async fetch(locationKey, signal) {
    if (signal.aborted || scenario === "UNAVAILABLE") throw new Error("Test forecast unavailable");
    const epoch = Math.floor(now().getTime() / 900_000) * 900_000;
    const hex = createHash("sha256").update(locationKey + scenario + epoch).digest("hex");
    const forecastId = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
    return { schemaVersion: 1, source: "TEST_FIXTURE", provider: "synthetic", forecastId, locationKey,
      issuedAt: new Date(epoch).toISOString(), validFrom: new Date(epoch).toISOString(), validTo: new Date(epoch + 8 * 86400_000).toISOString(), expiresAt: new Date(epoch + 900_000).toISOString(),
      rain: scenario === "RAIN" ? "EXPECTED" : "NOT_EXPECTED", signals: { plantingWindow: scenario === "PLANTING", irrigationNeeded: scenario === "IRRIGATION", extremeExpected: scenario === "EXTREME" } };
  } };
}
