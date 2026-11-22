import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { officerPermissionSchema } from "./dashboard";

export const grantOfficerSchema = z.object({
  requestId: idSchema, officerId: idSchema,
  permissions: z.array(officerPermissionSchema).min(1).max(3)
    .refine(values => new Set(values).size === values.length && values.includes("DASHBOARD")),
  confirmed: z.literal(true),
}).strict();
export const revokeOfficerSchema = z.object({ requestId: idSchema, assignmentId: idSchema, expectedVersion: z.number().int().positive(), confirmed: z.literal(true) }).strict();
export type GrantOfficer = z.infer<typeof grantOfficerSchema>;
export type RevokeOfficer = z.infer<typeof revokeOfficerSchema>;
export interface AssignmentView {
  assignmentId: string; officerId: string; permissions: string[]; version: number;
  grantedAt: string; revokedAt: string | null;
}
