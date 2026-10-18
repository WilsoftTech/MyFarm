import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { ENTERPRISE_TYPES, PRODUCTION_WORKFLOWS } from "../domain/production";

/**
 * Shape of a reviewed catalog data release (D-P03-012). Names are validated, not rewritten, by
 * applyCatalogRelease because they ship verbatim in reviewed SQL. Runtime roles never write catalogs.
 */
export const catalogReleaseSchema = z.object({
  additions: z.array(z.object({ id: idSchema, name: z.string() }).strict()).max(200),
  deactivations: z.array(idSchema).max(200).default([]),
}).strict();
export type CatalogReleaseInput = z.output<typeof catalogReleaseSchema>;

/** Read-only capability DTO: lets every screen and API show the same "workflow not yet available" state. */
export const enterpriseCapabilitySchema = z.object({
  type: z.enum(ENTERPRISE_TYPES),
  workflow: z.enum(PRODUCTION_WORKFLOWS).nullable(),
}).strict();
export type EnterpriseCapability = z.output<typeof enterpriseCapabilitySchema>;
