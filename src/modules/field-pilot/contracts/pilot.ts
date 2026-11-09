import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { SUPPORT_SEVERITIES, type PilotMeasures } from "../domain/measures";
import { PILOT_CONSENT_VERSION } from "../domain/consent";

/**
 * Field pilot commands (R001, D-P09-006 to D-P09-009). Actor, tenant, cohort ownership and pseudonyms are
 * server-owned: none of them is accepted from a client. requestId follows the existing retry contracts.
 */
const calendarDay = z.string().refine(isCalendarDate, "Enter a real date as YYYY-MM-DD.");
const expectedVersion = z.number().int().positive().max(2147483646);
const plain = (min: number, max: number) => z.string().trim().min(min, "Enter at least " + min + " characters.").max(max, "Use " + max + " characters or fewer.");

/** About one season (D-P09-002); a longer window would hide whether use lasts. */
export const MAX_COHORT_DAYS = 200;
export const createCohortSchema = z.object({ requestId: idSchema, name: plain(3, 120), startOn: calendarDay, endOn: calendarDay }).strict()
  .refine(value => value.endOn >= value.startOn, { message: "The end must be on or after the start.", path: ["endOn"] })
  .refine(value => (Date.parse(value.endOn) - Date.parse(value.startOn)) / 86_400_000 <= MAX_COHORT_DAYS, { message: "A cohort runs for one season: at most " + MAX_COHORT_DAYS + " days.", path: ["endOn"] });

export const COHORT_CODE = /^[A-Z0-9]{6,12}$/;
/** Codes are read out and typed on phones, so spaces, dashes and case are forgiven. */
export const joinCohortSchema = z.object({
  requestId: idSchema,
  code: z.string().transform(value => value.replace(/[\s-]/g, "").toUpperCase()).refine(value => COHORT_CODE.test(value), "Enter the code the MyFarm team gave you."),
  consentVersion: z.literal(PILOT_CONSENT_VERSION, { message: "Read the latest words and agree again." }),
  agreed: z.literal(true, { message: "Tick the box to agree, or leave this page." }),
}).strict();
export const withdrawSchema = z.object({ requestId: idSchema, participationId: idSchema, expectedVersion, confirmed: z.literal(true) }).strict();

/** Staff logs. A reference, never a name or phone number: the pseudonym identifies the farmer. */
export const paperConsentSchema = z.object({ requestId: idSchema, participationId: idSchema, paperConsentRef: plain(1, 60), expectedVersion }).strict();
export const PROMPT_CHANNELS = ["CALL", "SMS", "VISIT", "OTHER"] as const;
export const promptSchema = z.object({ requestId: idSchema, participationId: idSchema, promptedOn: calendarDay, channel: z.enum(PROMPT_CHANNELS) }).strict();
export const SUPPORT_CATEGORIES = ["SIGN_IN", "SYNC", "DATA_ENTRY", "UNDERSTANDING", "DEVICE", "OTHER"] as const;
export const supportIncidentSchema = z.object({
  requestId: idSchema,
  participationId: z.union([z.literal(""), idSchema]).optional().transform(value => value || undefined),
  openedOn: calendarDay, category: z.enum(SUPPORT_CATEGORIES), severity: z.enum(SUPPORT_SEVERITIES), summary: plain(3, 500),
}).strict();
export const resolveIncidentSchema = z.object({ requestId: idSchema, incidentId: idSchema, resolvedOn: calendarDay, expectedVersion }).strict();
export type CreateCohort = z.output<typeof createCohortSchema>;
export type JoinCohort = z.output<typeof joinCohortSchema>;
export type SupportIncidentInput = z.output<typeof supportIncidentSchema>;

/** What a farmer sees of their own participation; staff details stay out of it. */
export interface MyParticipation { participationId: string; cohortName: string; pseudonym: string; status: "ENROLLED" | "WITHDRAWN"; enrolledOn: string; version: number }
export interface CohortSummary { cohortId: string; name: string; code: string; startOn: string; endOn: string; status: "ACTIVE" | "CLOSED"; joined: number }
/** The staff view: measures and pseudonyms only (D-P09-007). Never names, phone numbers, money or records. */
export interface CohortView { cohort: CohortSummary; asOf: string; today: string; measures: PilotMeasures; paperConsentMissing: string[] }
