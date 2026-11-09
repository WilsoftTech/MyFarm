import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { SUPPORT_SEVERITIES, type PilotFacts, type PilotMeasures } from "../domain/measures";
import { PILOT_CONSENT_VERSION } from "../domain/consent";
import { OBSERVATION_KINDS, OBSERVED_SCREENS, REVIEW_DECISIONS, type Finding, type FindingView, type GateSnapshot, type Observation, type ObservationView, type ParticipantState, type ReviewDecision } from "../domain/evidence";

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

/**
 * R002 (P0555-P0566). Observations are dated notes of real use; a finding must cite them; a review records a
 * decision with the server's own gate figures. Nothing here accepts downloads, installs or a client's gate figures.
 */
export const observationSchema = z.object({
  requestId: idSchema,
  participationId: z.union([z.literal(""), idSchema]).optional().transform(value => value || undefined),
  observedOn: calendarDay, screen: z.enum(OBSERVED_SCREENS), kind: z.enum(OBSERVATION_KINDS), note: plain(3, 500),
}).strict();
export const MAX_FINDING_EVIDENCE = 50;
export const findingSchema = z.object({ requestId: idSchema, title: plain(3, 160), observationIds: z.array(idSchema).min(1, "Choose at least one observation.").max(MAX_FINDING_EVIDENCE) }).strict();
export const closeFindingSchema = z.object({ requestId: idSchema, findingId: idSchema, status: z.enum(["ACTIONED", "DISMISSED"]), expectedVersion }).strict();
export const reviewSchema = z.object({ requestId: idSchema, decision: z.enum(REVIEW_DECISIONS), reason: plain(3, 1000) }).strict();
export type ObservationInput = z.output<typeof observationSchema>;

export interface ReviewView { reviewId: string; reviewedOn: string; decision: ReviewDecision; gate: GateSnapshot | null; onboarded: number; reason: string }
export interface FindingRow extends Finding { version: number }
export interface EvidenceView {
  cohort: CohortSummary;
  today: string;
  observations: ObservationView[];
  findings: (FindingView & { version: number })[];
  reviews: ReviewView[];
  /** What the evidence allows today (D-P09-004), and the gate figures a review would record. */
  allowed: ReviewDecision[];
  gate: GateSnapshot | null;
}
/** R002 port. Every method constrains the cohort to the staff organization. */
export interface EvidenceRepository {
  observations(scope: StaffScope, cohortId: string): Promise<Observation[]>;
  participantStates(scope: StaffScope, cohortId: string): Promise<ParticipantState[]>;
  findings(scope: StaffScope, cohortId: string): Promise<FindingRow[]>;
  reviews(scope: StaffScope, cohortId: string): Promise<ReviewView[]>;
  recordObservation(scope: StaffScope, cohortId: string, input: ObservationInput): Promise<{ observationId: string }>;
  createFinding(scope: StaffScope, cohortId: string, input: z.output<typeof findingSchema>): Promise<{ findingId: string }>;
  closeFinding(scope: StaffScope, cohortId: string, input: z.output<typeof closeFindingSchema>): Promise<{ findingId: string }>;
  recordReview(scope: StaffScope, cohortId: string, input: z.output<typeof reviewSchema> & { reviewedOn: string; onboarded: number; gate: GateSnapshot | null }): Promise<ReviewView>;
}
