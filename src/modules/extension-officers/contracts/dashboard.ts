import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";

const id = idSchema.transform(value => value.toLowerCase());
const instant = z.iso.datetime({ offset: true });
const calendarDate = z.string().refine(isCalendarDate, "Enter a valid calendar date.");
const farm = { tenantId: id, farmId: id, farmerId: id };
export const officerPermissionSchema = z.enum(["DASHBOARD", "VISITS", "FOLLOW_UPS"]);
export type OfficerPermission = z.infer<typeof officerPermissionSchema>;

/** Current server projection, never proof of consent supplied by a browser.
 * The repository must verify the granting owner's active ownership and the named assignment.
 * No default expiry duration is imposed. A non-null revocation always denies access.
 */
export const assignmentFactSchema = z.object({
  ...farm, id, officerId: id, grantedByOwnerId: id, currentOwnerId: id,
  ownerActive: z.boolean(), validFrom: instant, expiresAt: instant.nullable(), revokedAt: instant.nullable(),
  permissions: z.array(officerPermissionSchema).min(1).max(3).refine(values => new Set(values).size === values.length),
}).strict().refine(value => value.expiresAt === null || Date.parse(value.expiresAt) > Date.parse(value.validFrom), "Expiry must follow grant start.");
export type AssignmentFact = z.infer<typeof assignmentFactSchema>;
export const assignmentFarmSchema = z.object(farm).strict();
export type AssignmentFarm = z.infer<typeof assignmentFarmSchema>;

const visitFactSchema = z.object({
  ...farm, id, officerId: id, scheduledOn: calendarDate,
  status: z.enum(["PLANNED", "COMPLETED", "CANCELLED"]),
}).strict();
const followUpFactSchema = z.object({
  ...farm, id, officerId: id, dueOn: calendarDate, status: z.enum(["OPEN", "COMPLETED", "CANCELLED"]),
}).strict();
const problemFactSchema = z.object({
  ...farm, id, officerId: id, visitId: id, explicitlyFlagged: z.boolean(), resolved: z.boolean(),
}).strict();

/** COMPLETE means every relevant current fact was read consistently, without pagination loss.
 * PARTIAL (including a truncated assignment list) must never yield authoritative totals.
 * All facts are server-derived; parsing this DTO does not authenticate its contents.
 */
export const dashboardFactsSchema = z.object({
  coverage: z.enum(["COMPLETE", "PARTIAL"]),
  assignments: z.array(assignmentFactSchema).max(10_000),
  visits: z.array(visitFactSchema).max(10_000),
  followUps: z.array(followUpFactSchema).max(10_000),
  problems: z.array(problemFactSchema).max(10_000),
}).strict();
export type DashboardFacts = z.infer<typeof dashboardFactsSchema>;
export interface DashboardCounts { myFarmers: number; visitsToday: number; followUps: number; problems: number }
export type OfficerDashboard = {
  asOf: string; today: string;
} & ({ coverage: "COMPLETE"; counts: DashboardCounts } | { coverage: "PARTIAL"; counts: null });
