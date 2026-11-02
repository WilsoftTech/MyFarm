import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate, type FarmScope } from "@/modules/enterprises-seasons/domain/production";
import { productionPageSchema, type ProductionPage, type ProductionPageInput, type ProductionRecord, type ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { ACTIVITY_BUCKETS, type ActivityBucket, type ActivityStatus } from "../domain/activity";
import type { ActivityCapability, ActivityType } from "../domain/catalog";
import { activityTypeSchema } from "./catalog";

const optionalId = z.union([z.literal(""), idSchema]).optional().transform(value => value || undefined);

/** Scope, actor and lifecycle status are server-owned. requestId follows existing retry contracts. */
export const scheduleActivitySchema = z.object({
  requestId: idSchema,
  type: activityTypeSchema,
  dueOn: z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD."),
  enterpriseId: optionalId,
  plotId: optionalId,
}).strict();
export const activityCapabilitiesSchema = z.object({ enterpriseId: optionalId }).strict();

const optionalText = (max: number) => z.string().trim().max(max, "Use " + max + " characters or fewer.").optional().transform(value => value || undefined);
const expectedVersion = z.number().int().positive().max(2147483646);
/** D-P06-004: free text only. The completing member comes from the session, never from this payload. */
export const activityDetailsSchema = z.object({ workerName: optionalText(120), notes: optionalText(1000), costRecordId: optionalId });
export const completeActivitySchema = activityDetailsSchema.extend({ requestId: idSchema, expectedVersion }).strict();
export const cancelActivitySchema = z.object({ requestId: idSchema, expectedVersion, reason: optionalText(500), confirmed: z.literal(true) }).strict();
export const activityPageSchema = productionPageSchema.extend({ bucket: z.enum(ACTIVITY_BUCKETS).optional() });

export type ScheduleActivity = z.output<typeof scheduleActivitySchema>;
export type CompleteActivity = z.output<typeof completeActivitySchema>;
export type CancelActivity = z.output<typeof cancelActivitySchema>;
export type ActivityPageInput = z.output<typeof activityPageSchema>;
export type { ActivityBucket, ActivityStatus };
export interface ActivityView extends FarmScope, ProductionRecord {
  activityId: string;
  type: ActivityType;
  typeLabel: string;
  dueOn: string;
  status: ActivityStatus;
  enterpriseId: string | null;
  enterpriseName: string | null;
  plotId: string | null;
  plotName: string | null;
}

/**
 * Every query constrains both tenantId and farmId, so a foreign parent or activity is treated as missing.
 * Writes recheck current membership and commit the effect with its audit receipt.
 */
export interface ActivityRepository {
  activity(scope: FarmScope, activityId: string): Promise<ActivityView | null>;
  activities(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<ActivityView>>;
  capabilities(scope: FarmScope, enterpriseId: string | undefined): Promise<ActivityCapability[] | null>;
  schedule(scope: ProductionWriteScope, command: ScheduleActivity): Promise<ActivityView>;
}
