import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { ACTIVITY_TIME_ZONE, farmToday } from "@/modules/farm-activities/domain/activity";
import { testForecastSchema, type TestForecastAdapter, type TestForecast } from "../contracts/weather";
import { weatherConfirmationSchema, weatherRequestSchema, weatherReviewRequestSchema, type WeatherReport, type WeatherRequest, type WeatherReview, type WeatherSources, type WeatherWriter } from "../contracts/service";
import { evaluateWeatherActivity } from "../domain/weather-activity";
import { testWeatherNotices } from "../domain/notices";

export class WeatherService {
  constructor(private readonly auth: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly sources: WeatherSources,
    private readonly adapter: (scenario: WeatherRequest["scenario"]) => TestForecastAdapter, private readonly writer: WeatherWriter,
    private readonly digest: (value: object) => string, private readonly now = () => new Date(), private readonly timeoutMs = 1500) {}
  async check(farmId: unknown, input: unknown): Promise<WeatherReport> {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const request = parse(weatherRequestSchema, input);
    const [farm, activity, crop] = await Promise.all([this.sources.farm(scope), request.activityId ? this.sources.activity(scope.farmId, request.activityId) : null, request.cycleId ? this.sources.crop(scope.farmId, request.cycleId) : null]);
    if (!farm) throw new FoundationError("FORBIDDEN");
    if (crop && activity && ((activity.enterpriseId && activity.enterpriseId !== crop.enterpriseId) || (activity.plotId && activity.plotId !== crop.plotId))) throw new FoundationError("FORBIDDEN");
    if (crop && crop.status !== "ACTIVE") throw new FoundationError("CONFLICT");
    const key = "place-" + this.digest({ district: farm.district.trim().toLowerCase() }).slice(0, 32);
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let forecast: TestForecast | null = null;
    try {
      if (!farm.district.trim()) throw new Error("Approximate place unavailable");
      const output = await Promise.race([this.adapter(request.scenario).fetch(key, controller.signal), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Weather timeout")); }, this.timeoutMs); })]);
      const parsed = testForecastSchema.safeParse(output);
      if (parsed.success && parsed.data.locationKey === key && Date.parse(parsed.data.issuedAt) <= this.now().getTime() && this.now().getTime() < Date.parse(parsed.data.expiresAt)) forecast = parsed.data;
    } catch { /* Explicit unavailable report; no invented weather. */ }
    finally { if (timer) clearTimeout(timer); controller.abort(); }
    await authorizeProductionFarm(this.auth, this.farms, scope.farmId);
    const context = { tenantId: scope.tenantId, farmId: scope.farmId, location: farm.district.trim() ? { key, label: farm.district, precision: "APPROXIMATE" as const } : null,
      timeZone: ACTIVITY_TIME_ZONE, crop: crop ? { cycleId: crop.cycleId, label: crop.cropName, stage: request.stage, stageSource: "FARMER" as const } : null };
    return { testOnly: true, checkedAt: this.now().toISOString(), district: farm.district, stage: request.stage, crop: crop?.cropName ?? null,
      forecast, notices: testWeatherNotices(forecast, this.now()), activity: activity ? evaluateWeatherActivity({ context, activity: { tenantId: activity.tenantId, farmId: activity.farmId, activityId: activity.activityId, type: activity.type, dueOn: activity.dueOn, status: activity.status, version: activity.version }, forecast }, this.now()) : null,
      recurring: activity?.recurrenceId !== null && activity?.recurrenceId !== undefined,
      taskContext: activity ? { enterprise: activity.enterpriseName, plot: activity.plotName } : null };
  }
  async review(farmId: unknown, input: unknown): Promise<WeatherReview> {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const request = parse(weatherReviewRequestSchema, input);
    const report = await this.check(scope.farmId, request.input);
    if (!report.activity || report.activity.status !== "TEST_NOTICE" || !report.forecast || report.recurring || request.newDueOn === report.activity.activity.dueOn || request.newDueOn < farmToday(this.now())) throw new FoundationError("CONFLICT");
    const command = { input: request.input, newDueOn: request.newDueOn, oldDueOn: report.activity.activity.dueOn, expectedVersion: report.activity.activity.version, expiresAt: report.forecast.expiresAt };
    const reviewHash = this.digest({ scope, command, forecast: report.forecast, context: report.activity.context, taskContext: report.taskContext });
    return { report, confirmation: { ...command, reviewHash } };
  }
  async confirm(farmId: unknown, input: unknown) {
    const { scope } = await authorizeProductionFarm(this.auth, this.farms, farmId);
    const command = parse(weatherConfirmationSchema, input);
    const replay = await this.writer.replay(scope, command);
    if (replay) return replay;
    const review = await this.review(scope.farmId, { input: command.input, newDueOn: command.newDueOn });
    if (review.confirmation.reviewHash !== command.reviewHash || review.confirmation.oldDueOn !== command.oldDueOn || review.confirmation.expectedVersion !== command.expectedVersion || review.confirmation.expiresAt !== command.expiresAt) throw new FoundationError("CONFLICT");
    return this.writer.move(scope, command, review.report.district);
  }
}
