import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import type { ActivityRecord } from "@/modules/farm-activities/contracts/activity";
import type { CropCycleView } from "@/modules/enterprises-seasons/contracts/crop-cycle";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import type { WeatherActivityEvaluation } from "../domain/weather-activity";
import type { TestForecast } from "./weather";
const canonicalId = idSchema.transform(value => value.toLowerCase());
export const SCENARIOS = ["RAIN", "PLANTING", "IRRIGATION", "EXTREME", "NONE", "UNAVAILABLE"] as const;
export const weatherRequestSchema = z.object({
  scenario: z.enum(SCENARIOS), activityId: canonicalId.nullable(), cycleId: canonicalId.nullable(), stage: z.string().trim().min(1).max(120).nullable(),
}).strict().refine(value => value.stage === null || value.cycleId !== null);
const day = z.string().refine(isCalendarDate);
export const weatherReviewRequestSchema = z.object({ input: weatherRequestSchema, newDueOn: day }).strict();
export const weatherConfirmationSchema = z.object({
  requestId: canonicalId, input: weatherRequestSchema, newDueOn: day, oldDueOn: day,
  expectedVersion: z.number().int().positive().max(2147483646), reviewHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.iso.datetime(), confirmed: z.literal(true),
}).strict();
export type WeatherRequest = z.output<typeof weatherRequestSchema>;
export type WeatherConfirmation = z.output<typeof weatherConfirmationSchema>;
export interface WeatherNotice { key: "FORECAST" | "RAIN" | "PLANTING" | "SPRAYING" | "IRRIGATION" | "EXTREME"; status: "TEST_SIGNAL" | "NO_SIGNAL" | "UNAVAILABLE"; message: string }
export interface WeatherReport {
  testOnly: true; checkedAt: string; district: string; stage: string | null; crop: string | null;
  forecast: TestForecast | null; notices: WeatherNotice[]; activity: WeatherActivityEvaluation | null; recurring: boolean;
  taskContext: { enterprise: string | null; plot: string | null } | null;
}
export interface WeatherReview { report: WeatherReport; confirmation: Omit<WeatherConfirmation, "confirmed" | "requestId"> }
export interface WeatherReceipt { activityId: string; oldDueOn: string; newDueOn: string; version: number; receiptId: string }
export interface WeatherSources {
  farm(scope: ProductionWriteScope): Promise<{ district: string } | null>;
  activity(farmId: string, id: string): Promise<ActivityRecord>;
  crop(farmId: string, id: string): Promise<CropCycleView>;
}
export interface WeatherWriter {
  replay(scope: ProductionWriteScope, command: WeatherConfirmation): Promise<WeatherReceipt | null>;
  move(scope: ProductionWriteScope, command: WeatherConfirmation, district: string): Promise<WeatherReceipt>;
}

/** Display projection: validate every displayed value; omit server-only contextual fields. */
export const weatherDisplaySchema = z.object({
  testOnly: z.literal(true), checkedAt: z.iso.datetime(), district: z.string().max(120), crop: z.string().max(120).nullable(), stage: z.string().max(120).nullable(),
  forecast: z.object({ provider: z.literal("synthetic"), issuedAt: z.iso.datetime(), expiresAt: z.iso.datetime(), validFrom: z.iso.datetime(), validTo: z.iso.datetime() }).nullable(),
  notices: z.array(z.object({ key: z.enum(["FORECAST", "RAIN", "PLANTING", "SPRAYING", "IRRIGATION", "EXTREME"]), status: z.enum(["TEST_SIGNAL", "NO_SIGNAL", "UNAVAILABLE"]), message: z.string().max(400) })).length(6),
  activity: z.object({ status: z.enum(["TEST_NOTICE", "NOT_ASSESSED", "NO_MATCH"]), message: z.string().max(700), limitations: z.array(z.string().max(60)).max(20), activity: z.object({ activityId: idSchema, dueOn: day, version: z.number().int().positive(), label: z.string().max(120) }) }).nullable(),
  recurring: z.boolean(),
  taskContext: z.object({ enterprise: z.string().max(120).nullable(), plot: z.string().max(120).nullable() }).nullable(),
});
export const weatherReviewDisplaySchema = z.object({ report: weatherDisplaySchema, confirmation: weatherConfirmationSchema.omit({ requestId: true, confirmed: true }) }).strict();
export const weatherReceiptSchema = z.object({ activityId: idSchema, oldDueOn: day, newDueOn: day, version: z.number().int().positive(), receiptId: idSchema }).strict();
