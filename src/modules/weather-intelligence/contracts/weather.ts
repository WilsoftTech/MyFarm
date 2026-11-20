import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { ACTIVITY_TIME_ZONE } from "@/modules/farm-activities/domain/activity";
import { activityTypeSchema } from "@/modules/farm-activities/contracts/catalog";

const label = z.string().trim().min(1).max(120);
const locationKey = z.string().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/);
const scope = { tenantId: idSchema, farmId: idSchema };

/** Q22 staged scope: approximate places only; no GPS or inferred crop stage. */
export const weatherContextSchema = z.object({
  ...scope,
  location: z.object({ key: locationKey, label, precision: z.literal("APPROXIMATE") }).strict().nullable(),
  timeZone: z.literal(ACTIVITY_TIME_ZONE).nullable(),
  crop: z.object({ cycleId: idSchema, label, stage: label.nullable(), stageSource: z.literal("FARMER") }).strict().nullable(),
}).strict();

/** A service must load this through the existing authorized activities service, never trust a browser's scope. */
export const weatherActivitySchema = z.object({
  ...scope, activityId: idSchema, type: activityTypeSchema,
  dueOn: z.string().refine(isCalendarDate),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
  version: z.number().int().positive().max(2147483646),
}).strict();

/** Synthetic signals exercise the source example; they are neither live observations nor reviewed agronomic rules. */
export const testForecastSchema = z.object({
  schemaVersion: z.literal(1), source: z.literal("TEST_FIXTURE"),
  forecastId: idSchema, provider: z.literal("synthetic"), locationKey,
  issuedAt: z.iso.datetime(), validFrom: z.iso.datetime(), validTo: z.iso.datetime(), expiresAt: z.iso.datetime(),
  rain: z.enum(["EXPECTED", "NOT_EXPECTED", "UNKNOWN"]),
  signals: z.object({ plantingWindow: z.boolean(), irrigationNeeded: z.boolean(), extremeExpected: z.boolean() }).strict().optional(),
}).strict().refine(value => {
  const issued = Date.parse(value.issuedAt), from = Date.parse(value.validFrom), to = Date.parse(value.validTo), expiry = Date.parse(value.expiresAt);
  return issued <= from && from < to && issued < expiry && expiry <= to;
}, "Use an ordered forecast window and an explicit expiry within its validity.");

export const weatherEvaluationSchema = z.object({ context: weatherContextSchema, activity: weatherActivitySchema, forecast: testForecastSchema.nullable() }).strict();
export type TestForecast = z.output<typeof testForecastSchema>;
export type WeatherContext = z.output<typeof weatherContextSchema>;
export type WeatherActivity = z.output<typeof weatherActivitySchema>;

/** Future adapters get a coarse place and cancellation only, with no actor, farm, crop or task identifiers. */
export interface TestForecastAdapter {
  fetch(locationKey: string, signal: AbortSignal): Promise<unknown>;
}
