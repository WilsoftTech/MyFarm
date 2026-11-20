import type { TestForecast } from "../contracts/weather";
import type { WeatherNotice } from "../contracts/service";

/** Reviewed software fixture rules only. These signals have no agronomic threshold or treatment authority. */
export function testWeatherNotices(forecast: TestForecast | null, now: Date): WeatherNotice[] {
  const current = forecast && Date.parse(forecast.issuedAt) <= now.getTime() && now.getTime() < Date.parse(forecast.expiresAt);
  const flags = current ? [true, forecast.rain === "EXPECTED", forecast.signals?.plantingWindow, forecast.rain === "EXPECTED", forecast.signals?.irrigationNeeded, forecast.signals?.extremeExpected] : [];
  const labels = ["Forecast", "Rain alert", "Planting window", "Spraying warning", "Irrigation alert", "Extreme-weather alert"];
  return (["FORECAST", "RAIN", "PLANTING", "SPRAYING", "IRRIGATION", "EXTREME"] as const).map((key, i) => ({
    key, status: !current ? "UNAVAILABLE" : flags[i] ? "TEST_SIGNAL" : "NO_SIGNAL",
    message: !current ? `${labels[i]}: no current test forecast. No weather conclusion is available.` : flags[i]
      ? `${labels[i]}: synthetic signal for testing only. This is not live weather or advice to plant, spray, irrigate or take emergency action.`
      : `${labels[i]}: no matching test signal. This does not establish suitable or safe conditions.`,
  }));
}
