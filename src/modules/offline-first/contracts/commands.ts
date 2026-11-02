import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { recordExpenseSchema, recordIncomeSchema } from "@/modules/farm-accounting/contracts/accounting";
import { recordHarvestSchema } from "@/modules/harvest-inventory/contracts/harvest";
import { completeActivitySchema, scheduleActivitySchema } from "@/modules/farm-activities/contracts/activity";
import { OFFLINE_OPERATIONS, PHOTO_TARGETS, PULL_SECTIONS, type OfflineOperation, type PullSection } from "../domain/commands";

/**
 * Each command reuses the exact server schema, so the phone and the server cannot disagree about what is valid.
 * requestId is the clientMutationId: existing receipts already give it replay behavior.
 */
const completeOffline = completeActivitySchema.omit({ expectedVersion: true }).extend({ activityId: idSchema });
export const attachPhotoSchema = z.object({ requestId: idSchema, photoId: idSchema, target: z.enum(PHOTO_TARGETS), recordId: idSchema.optional(), parentMutationId: idSchema.optional() }).strict()
  .refine(value => Boolean(value.recordId) !== Boolean(value.parentMutationId), { message: "A photo attaches to one record." });
const operationSchemas: Record<OfflineOperation, z.ZodType> = {
  RECORD_EXPENSE: recordExpenseSchema, RECORD_INCOME: recordIncomeSchema, RECORD_HARVEST: recordHarvestSchema, RECORD_ACTIVITY: scheduleActivitySchema, CREATE_TASK: scheduleActivitySchema, COMPLETE_ACTIVITY: completeOffline, ATTACH_PHOTO: attachPhotoSchema,
};
export type CommandCheck = { ok: true; payload: Record<string, unknown> } | { ok: false; errors: Record<string, string> };
/** The form shows these errors before anything is saved, because a rejected command would otherwise wait until reconnection to fail. */
export function checkOfflineCommand(operation: OfflineOperation, clientMutationId: string, input: Record<string, unknown>): CommandCheck {
  const result = operationSchemas[operation].safeParse({ ...input, requestId: clientMutationId });
  if (result.success) return { ok: true, payload: result.data as Record<string, unknown> };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false, errors };
}

/** One command as sent. Client identity fields are routing hints; scope and permission come from the session. */
export const pushCommandSchema = z.object({
  clientMutationId: idSchema,
  deviceId: idSchema,
  farmId: idSchema,
  operation: z.enum(OFFLINE_OPERATIONS),
  payload: z.record(z.string(), z.unknown()),
  baseVersion: z.number().int().positive().max(2147483646).nullable(),
  createdAt: z.iso.datetime(),
}).strict();
export type PushCommand = z.output<typeof pushCommandSchema>;
export const pushRequestSchema = z.object({ commands: z.array(pushCommandSchema).min(1).max(20) }).strict();

export const pullPositionSchema = z.object({ snapshotId: idSchema, issuedAt: z.iso.datetime(), farmIndex: z.number().int().nonnegative().max(1000), sectionIndex: z.number().int().nonnegative().max(PULL_SECTIONS.length - 1), pageCursor: idSchema.nullable(), taken: z.number().int().nonnegative().max(100_000) }).strict();
export const pullQuerySchema = z.object({ cursor: z.string().min(1).max(1000).optional() }).strict();
export type PullPage =
  | { status: "EXPIRED" }
  | { status: "OK"; snapshotId: string; farms: { farmId: string; name: string }[]; farmId: string | null; section: PullSection | null; items: Record<string, unknown>[]; nextCursor: string | null };
