import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate, type FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ProductionRecord } from "@/modules/enterprises-seasons/contracts/production";
import { RECURRENCE_FREQUENCIES, type RecurrenceFrequency } from "../domain/recurrence";
import type { ActivityType } from "../domain/catalog";
import { activityTypeSchema } from "./catalog";

const date = z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD.");
const optionalDate = z.union([z.literal(""), date]).optional().transform(value => value || undefined);
const optionalId = z.union([z.literal(""), idSchema]).optional().transform(value => value || undefined);
const optionalText = (max: number) => z.string().trim().max(max, "Use " + max + " characters or fewer.").optional().transform(value => value || undefined);
const expectedVersion = z.number().int().positive().max(2147483646);
const pattern = {
  frequency: z.enum(RECURRENCE_FREQUENCIES, { error: "Choose how often it repeats." }),
  interval: z.number().int().min(1, "Repeat at least every 1.").max(365, "Use 365 or fewer."),
  endOn: optionalDate,
  workerName: optionalText(120),
  notes: optionalText(1000),
};

/** Scope and actor are server-owned. Each generated occurrence links its own cost when it is completed. */
export const createRecurrenceSchema = z.object({ requestId: idSchema, type: activityTypeSchema, startOn: date, enterpriseId: optionalId, plotId: optionalId, ...pattern }).strict()
  .refine(value => !value.endOn || value.endOn >= value.startOn, { message: "The end date must be on or after the start date.", path: ["endOn"] });
/** D-P06-003: a change applies from a chosen date onward; earlier occurrences stay as they are. */
export const changeRecurrenceSchema = z.object({ requestId: idSchema, expectedVersion, effectiveFrom: date, ...pattern }).strict()
  .refine(value => !value.endOn || value.endOn >= value.effectiveFrom, { message: "The end date must be on or after the change date.", path: ["endOn"] });
export const stopRecurrenceSchema = z.object({ requestId: idSchema, expectedVersion, stopFrom: date, confirmed: z.literal(true) }).strict();

export type CreateRecurrence = z.output<typeof createRecurrenceSchema>;
export type ChangeRecurrence = z.output<typeof changeRecurrenceSchema>;
export type StopRecurrence = z.output<typeof stopRecurrenceSchema>;
export interface RecurrenceView extends FarmScope, ProductionRecord {
  recurrenceId: string;
  type: ActivityType;
  typeLabel: string;
  frequency: RecurrenceFrequency;
  interval: number;
  startOn: string;
  endOn: string | null;
  stoppedFrom: string | null;
  enterpriseId: string | null;
  enterpriseName: string | null;
  plotId: string | null;
  plotName: string | null;
  workerName: string | null;
  notes: string | null;
  previousId: string | null;
}
