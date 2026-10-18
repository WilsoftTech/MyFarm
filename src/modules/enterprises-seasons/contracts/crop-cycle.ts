import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { AREA_UNITS } from "@/modules/farmer-registry/domain/rules";
import { isCalendarDate, type FarmScope, type ProductionStatus } from "../domain/production";
import { isCropDateRange, normalizePlantedArea, type CropCycleFields } from "../domain/crop-cycle";
import { cropCycleLinksSchema, type ProductionPage, type ProductionPageInput, type ProductionRecord, type ProductionWriteScope } from "./production";

const date = z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD.");
const optionalText = (max: number) => z.string().trim().max(max, "Use " + max + " characters or fewer.").optional().transform(value => value || undefined);

/** Parent IDs are untrusted references; tenant, actor, status and versions are server-owned. */
export const startCropCycleSchema = cropCycleLinksSchema.extend({
  requestId: idSchema,
  cropId: idSchema,
  variety: optionalText(120),
  areaPlanted: z.string().trim().transform((value, context) => {
    const normalized = normalizePlantedArea(value);
    if (normalized === null) { context.addIssue({ code: "custom", message: "Enter a planted area greater than zero, with up to 12 whole digits and 6 decimal places." }); return z.NEVER; }
    return normalized;
  }),
  areaUnit: z.enum(AREA_UNITS, { error: "Choose an area unit." }),
  plantingDate: date,
  expectedHarvest: z.union([z.literal(""), date]).optional().transform(value => value || undefined),
  areaExceptionReason: optionalText(500),
}).strict().refine(value => isCropDateRange(value.plantingDate, value.expectedHarvest), {
  message: "The expected harvest must be on or after the planting date.", path: ["expectedHarvest"],
});
export type StartCropCycle = z.output<typeof startCropCycleSchema>;

export interface CropCycleView extends FarmScope, ProductionRecord, Omit<CropCycleFields, "variety" | "expectedHarvest" | "areaExceptionReason"> {
  cycleId: string;
  cropName: string;
  variety: string | null;
  expectedHarvest: string | null;
  areaExceptionReason: string | null;
  status: ProductionStatus;
}

/**
 * Implemented in T005; application authorization precedes all calls.
 * Farm-record reads constrain tenant AND farm, including nested IDs and pagination anchors.
 * Catalog entries are global reference data; the service authorizes farm access before lookup.
 * startCropCycle must authenticate/recheck current membership, resolve all parents and an
 * active catalog crop, and serialize capacity checks per plot inside the write transaction.
 * Load ALL active allocations on that plot across enterprises/seasons (not a paginated list).
 * Reuse assertCropCycleStart; unknown area/unit or mismatched units fail without conversion.
 * Persist the exception reason with the cycle and atomic actor/scope/request audit receipt.
 * Initial state is ACTIVE/version 1. Identical normalized retries replay BEFORE allocating
 * again; a changed command or farm conflicts. Failures roll back both row and receipt.
 * Closure/reopening, catalog administration and durable offline sync are separate scope.
 */
export interface CropCycleRepository {
  crops(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<{ cropId: string; name: string }>>;
  cropCycle(scope: FarmScope, cycleId: string): Promise<CropCycleView | null>;
  cropCycles(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<CropCycleView>>;
  startCropCycle(scope: ProductionWriteScope, command: StartCropCycle): Promise<CropCycleView>;
}
