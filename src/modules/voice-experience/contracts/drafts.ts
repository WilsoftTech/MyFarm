import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { confirmVoiceReviewSchema, voiceReviewSchema, type VoiceExpenseReview } from "./voice";

export const saveVoiceDraftSchema = z.object({ review: voiceReviewSchema }).strict();
export const editVoiceDraftSchema = saveVoiceDraftSchema.extend({ version: z.number().int().positive().max(2147483646) }).strict();
export const executeVoiceDraftSchema = confirmVoiceReviewSchema.extend({
  requestId: idSchema,
  version: z.number().int().positive().max(2147483647),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type VoiceDraftEdit = z.output<typeof editVoiceDraftSchema>;
export type VoiceDraftConfirmation = z.output<typeof executeVoiceDraftSchema>;
export const voiceDraftViewSchema = z.object({
  draftId: idSchema, farmId: idSchema, review: voiceReviewSchema,
  version: executeVoiceDraftSchema.shape.version, payloadHash: executeVoiceDraftSchema.shape.payloadHash, expiresAt: z.iso.datetime(),
  labels: z.object({ category: z.string(), paymentMethod: z.string().nullable(), enterprise: z.string().nullable(), season: z.string().nullable(), plot: z.string().nullable(), batch: z.string().nullable() }).strict(),
}).strict();
export const voiceExpenseReceiptSchema = z.object({
  draftId: idSchema, recordId: idSchema, version: executeVoiceDraftSchema.shape.version,
  payloadHash: executeVoiceDraftSchema.shape.payloadHash, confirmedAt: z.iso.datetime(),
}).strict();
export type VoiceDraftView = z.output<typeof voiceDraftViewSchema>;
export type VoiceExpenseReceipt = z.output<typeof voiceExpenseReceiptSchema>;
export const voiceDraftOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("PENDING"), draft: voiceDraftViewSchema }).strict(),
  z.object({ status: z.literal("COMPLETED"), receipt: voiceExpenseReceiptSchema }).strict(),
  z.object({ status: z.literal("EXPIRED") }).strict(),
]);
export type VoiceDraftOutcome = z.output<typeof voiceDraftOutcomeSchema>;
export interface VoiceDraftRepository {
  create(scope: ProductionWriteScope, review: VoiceExpenseReview): Promise<VoiceDraftView>;
  read(scope: ProductionWriteScope, draftId: string): Promise<VoiceDraftView>;
  outcome(scope: ProductionWriteScope, draftId: string): Promise<VoiceDraftOutcome>;
  edit(scope: ProductionWriteScope, draftId: string, input: VoiceDraftEdit): Promise<VoiceDraftView>;
  confirm(scope: ProductionWriteScope, draftId: string, input: VoiceDraftConfirmation): Promise<VoiceExpenseReceipt>;
}
