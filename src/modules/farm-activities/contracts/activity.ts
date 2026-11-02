import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate, type FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ProductionPage, ProductionPageInput, ProductionRecord, ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
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

export type ScheduleActivity = z.output<typeof scheduleActivitySchema>;
export const ACTIVITY_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type ActivityStatus = typeof ACTIVITY_STATUSES[number];
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
