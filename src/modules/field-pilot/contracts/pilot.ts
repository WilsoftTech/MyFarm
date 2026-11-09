import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { SUPPORT_SEVERITIES, type PilotFacts, type PilotMeasures } from "../domain/measures";
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
export interface CohortView { cohort: CohortSummary; asOf: string; today: string; measures: PilotMeasures; participants: StaffParticipant[]; incidents: IncidentView[] }

/** Staff act for one ORGANIZATION as ADMIN; the server derives both from the session and the chosen scope. */
export interface StaffScope { actorId: string; organizationId: string }
export interface CohortForJoining { cohortId: string; tenantId: string; name: string; status: "ACTIVE" | "CLOSED"; consentVersion: string; startOn: string; endOn: string }
export interface IncidentView { incidentId: string; pseudonym: string | null; openedOn: string; category: typeof SUPPORT_CATEGORIES[number]; severity: typeof SUPPORT_SEVERITIES[number]; summary: string; status: "OPEN" | "RESOLVED"; resolvedOn: string | null; version: number }
export interface StaffParticipant { participationId: string; pseudonym: string; enrolledOn: string; paperConsent: boolean; version: number }
/** Everything the measures need for one cohort; withdrawn participations are included so the rules can leave them out. */
export type CohortFacts = Omit<PilotFacts, "today">;

/** Write and read port. Every staff method constrains the cohort to the staff organization. */
export interface PilotRepository {
  isActiveFarmer(userId: string): Promise<boolean>;
  createCohort(scope: StaffScope, input: CreateCohort & { code: string; consentVersion: string }): Promise<CohortSummary>;
  cohorts(scope: StaffScope): Promise<CohortSummary[]>;
  cohort(scope: StaffScope, cohortId: string): Promise<CohortSummary | null>;
  cohortByCode(code: string): Promise<CohortForJoining | null>;
  join(input: { userId: string; cohort: CohortForJoining; requestId: string; enrolledOn: string }): Promise<MyParticipation>;
  myParticipations(userId: string): Promise<MyParticipation[]>;
  withdraw(input: { userId: string; participationId: string; requestId: string; expectedVersion: number }): Promise<MyParticipation>;
  facts(scope: StaffScope, cohortId: string): Promise<CohortFacts>;
  participants(scope: StaffScope, cohortId: string): Promise<StaffParticipant[]>;
  incidents(scope: StaffScope, cohortId: string): Promise<IncidentView[]>;
  recordPrompt(scope: StaffScope, cohortId: string, input: z.output<typeof promptSchema>): Promise<{ promptId: string }>;
  openIncident(scope: StaffScope, cohortId: string, input: SupportIncidentInput): Promise<IncidentView>;
  resolveIncident(scope: StaffScope, cohortId: string, input: z.output<typeof resolveIncidentSchema>): Promise<IncidentView>;
  recordPaperConsent(scope: StaffScope, cohortId: string, input: z.output<typeof paperConsentSchema>): Promise<StaffParticipant>;
}
