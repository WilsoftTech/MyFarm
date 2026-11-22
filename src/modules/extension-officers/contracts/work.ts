import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { farmerProfileSchema, farmSchema } from "@/modules/farmer-registry/contracts/registry";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { isLatitude, isLongitude } from "@/modules/farmer-registry/domain/rules";

const date = z.string().refine(isCalendarDate, "Enter a valid date.");
const text = (max: number) => z.string().trim().max(max);
export const registrationReviewSchema = z.object({ profile: farmerProfileSchema, farm: farmSchema }).strict();
export const prepareRegistrationSchema = z.object({ requestId: idSchema, targetUserId: idSchema, review: registrationReviewSchema }).strict();
export const acceptRegistrationSchema = z.object({ expectedVersion: z.number().int().positive(), payloadHash: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).strict();
export const recordVisitSchema = z.object({
  requestId: idSchema, assignmentId: idSchema, scheduledOn: date,
  status: z.enum(["PLANNED", "COMPLETED"]), observations: text(2000), recommendation: text(2000),
  latitude: z.string().refine(isLatitude).optional(), longitude: z.string().refine(isLongitude).optional(),
  followUp: z.object({ dueOn: date, notes: text(1000) }).strict().optional(),
  problem: z.string().trim().min(1).max(1000).optional(),
}).strict().refine(row => (row.latitude === undefined) === (row.longitude === undefined), "Enter both coordinates or neither.");
export const finishWorkSchema = z.object({ requestId: idSchema, expectedVersion: z.number().int().positive() }).strict();
export const visitPhotoSchema = z.object({ requestId: idSchema, visitId: idSchema, sha256: z.string().regex(/^[a-f0-9]{64}$/), contentType: z.enum(["image/png", "image/jpeg", "image/webp"]), byteSize: z.number().int().positive().max(2 * 1024 * 1024) }).strict();
export type RegistrationReview = z.output<typeof registrationReviewSchema>;
export type PrepareRegistration = z.output<typeof prepareRegistrationSchema>;
export type AcceptRegistration = z.output<typeof acceptRegistrationSchema>;
export type RecordVisit = z.output<typeof recordVisitSchema>;
export type FinishWork = z.output<typeof finishWorkSchema>;
export type VisitPhoto = z.output<typeof visitPhotoSchema>;
const provenance = z.object({
  schemaVersion: z.literal(1), clientMutationId: idSchema, deviceId: idSchema,
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
  version: z.number().int().positive(), syncStatus: z.enum(["PENDING", "SYNCING"]), organizationId: idSchema,
});
/** Transport provenance is untrusted; server authorization and time remain authoritative. */
export const officerEnvelopeSchema = z.discriminatedUnion("operation", [
  provenance.extend({ operation: z.literal("OFFICER_PREPARE_REGISTRATION"), payload: prepareRegistrationSchema }).strict(),
  provenance.extend({ operation: z.literal("OFFICER_RECORD_VISIT"), farmId: idSchema, payload: recordVisitSchema }).strict(),
  provenance.extend({ operation: z.literal("OFFICER_FINISH_FOLLOW_UP"), farmId: idSchema, recordId: idSchema, payload: finishWorkSchema }).strict(),
  provenance.extend({ operation: z.literal("OFFICER_RESOLVE_PROBLEM"), farmId: idSchema, recordId: idSchema, payload: finishWorkSchema }).strict(),
  provenance.extend({ operation: z.literal("OFFICER_ATTACH_PHOTO"), farmId: idSchema, payload: visitPhotoSchema }).strict(),
]).refine(row => row.clientMutationId === row.payload.requestId, "The mutation and payload must use the same request ID.");
export type OfficerEnvelope = z.output<typeof officerEnvelopeSchema>;
export const registrationDraftFactSchema = z.object({
  targetUserId: idSchema, version: z.number().int().positive(), payloadHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.iso.datetime({ offset: true }), acceptedFarmId: idSchema.nullable(), discardedAt: z.iso.datetime({ offset: true }).nullable(),
}).strict();
export interface RegistrationDraftView { draftId: string; officerAccountId: string; review: RegistrationReview | null; payloadHash: string; version: number; expiresAt: string; acceptedFarmId: string | null; canAccept: boolean }
export interface VisitView { visitId: string; assignmentId: string; scheduledOn: string; status: string; observations: string; recommendation: string; latitude: string | null; longitude: string | null; version: number; followUps: { id: string; dueOn: string; notes: string; status: string; version: number }[]; problems: { id: string; description: string; resolved: boolean; version: number }[]; photos: { id: string; contentType: string }[] }
export interface OfficerWorkRepository {
  prepare(actorId: string, organizationId: string, command: PrepareRegistration): Promise<{ draftId: string }>;
  draft(actorId: string, draftId: string): Promise<RegistrationDraftView>;
  accept(actorId: string, draftId: string, command: AcceptRegistration): Promise<{ farmId: string }>;
  discard(actorId: string, draftId: string): Promise<void>;
  recordVisit(actorId: string, organizationId: string, farmId: string, command: RecordVisit): Promise<{ recordId: string; version: number }>;
  visits(actorId: string, organizationId: string, farmId: string, assignmentId: string): Promise<VisitView[]>;
  finish(actorId: string, organizationId: string, farmId: string, kind: "FOLLOW_UP" | "PROBLEM", id: string, command: FinishWork): Promise<{ recordId: string; version: number }>;
  reservePhoto(actorId: string, organizationId: string, farmId: string, command: VisitPhoto): Promise<{ tenantId: string; uploaded: boolean }>;
  publishPhoto(actorId: string, organizationId: string, farmId: string, command: VisitPhoto): Promise<{ photoId: string }>;
  readablePhoto(actorId: string, organizationId: string, farmId: string, photoId: string): Promise<{ tenantId: string; role: "AGENT" | "FARMER" }>;
}
