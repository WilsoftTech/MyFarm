import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { farmPageSchema } from "@/modules/farmer-registry/contracts/registry";
import { ENTERPRISE_TYPES, isCalendarDate, type EnterpriseReference, type FarmScope, type PlotReference, type SeasonReference } from "../domain/production";

const name = (label: string) => z.string().trim().min(1, "Enter " + label + ".").max(120, "Use 120 characters or fewer.");
const date = z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD.");
const optionalDate = z.union([z.literal(""), date]).optional().transform(value => value || undefined);

// Actor, tenant and farm are deliberately absent: the route/service must derive them on the server.
export const createEnterpriseSchema = z.object({
  requestId: idSchema,
  name: name("an enterprise name"),
  type: z.enum(ENTERPRISE_TYPES, { error: "Choose an enterprise type." }),
}).strict();

export const createSeasonSchema = z.object({
  requestId: idSchema,
  label: name("a season name"),
  startDate: date,
  endDate: optionalDate,
}).strict().refine(value => !value.endDate || value.endDate >= value.startDate, {
  message: "The end date must be on or after the start date.", path: ["endDate"],
});

// Relationship subsets for the later crop/poultry commands; these are not complete creation payloads.
export const cropCycleLinksSchema = z.object({ enterpriseId: idSchema, seasonId: idSchema, plotId: idSchema }).strict();
export const poultryBatchLinksSchema = z.object({ enterpriseId: idSchema }).strict();
export const productionPageSchema = farmPageSchema;

export type CreateEnterprise = z.output<typeof createEnterpriseSchema>;
export type CreateSeason = z.output<typeof createSeasonSchema>;
export type ProductionPageInput = z.output<typeof productionPageSchema>;

export interface ProductionRecord {
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface EnterpriseView extends EnterpriseReference, ProductionRecord { name: string }
export interface SeasonView extends SeasonReference, ProductionRecord { label: string; startDate: string; endDate: string | null }
export interface ProductionPage<T> { items: T[]; nextCursor: string | null }
export interface ProductionWriteScope extends FarmScope { actorId: string }

/**
 * Port only: no persistence or runtime authorization is implemented by these types.
 * Every query must constrain BOTH tenantId and farmId. A foreign/missing parent returns null.
 * Writes must recheck current farm/tenant membership and atomically commit the effect and audit receipt.
 * Same actor/scope/request retries replay the original result; denied or failed writes leave no receipt.
 * Crop detail, quantity and closure commands belong to their subsequent implementation stages.
 */
export interface ProductionRepository {
  enterprise(scope: FarmScope, enterpriseId: string): Promise<EnterpriseView | null>;
  season(scope: FarmScope, seasonId: string): Promise<SeasonView | null>;
  plot(scope: FarmScope, plotId: string): Promise<PlotReference | null>;
  enterprises(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<EnterpriseView>>;
  seasons(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<SeasonView>>;
  createEnterprise(scope: ProductionWriteScope, command: CreateEnterprise): Promise<EnterpriseView>;
  createSeason(scope: ProductionWriteScope, command: CreateSeason): Promise<SeasonView>;
}
