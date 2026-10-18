import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate, type FarmScope, type ProductionStatus } from "../domain/production";
import { normalizeBatchLabel, normalizeBirdCount, POULTRY_PURPOSES, type CurrentQuantitySource, type PoultryBatchFields } from "../domain/poultry-batch";
import { poultryBatchLinksSchema, type ProductionPage, type ProductionPageInput, type ProductionRecord, type ProductionWriteScope } from "./production";

const optionalText = (max: number) => z.string().trim().max(max, "Use " + max + " characters or fewer.").optional().transform(value => value || undefined);

/** Enterprise and catalog IDs are untrusted references; tenant, actor, status, current count and versions are server-owned. */
export const startPoultryBatchSchema = poultryBatchLinksSchema.extend({
  requestId: idSchema,
  animalTypeId: idSchema,
  breed: optionalText(120),
  batchLabel: z.string().transform(normalizeBatchLabel).pipe(z.string().min(1, "Enter a batch name, for example Batch #004.").max(120, "Use 120 characters or fewer.")),
  startingQuantity: z.union([z.string(), z.number()]).transform((value, context) => {
    const count = normalizeBirdCount(value);
    if (count === null) { context.addIssue({ code: "custom", message: "Enter the number of birds as a whole number, 0 or more." }); return z.NEVER; }
    return count;
  }),
  acquisitionDate: z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD."),
  purpose: z.enum(POULTRY_PURPOSES, { error: "Choose a production purpose." }),
}).strict();
export type StartPoultryBatch = z.output<typeof startPoultryBatchSchema>;

export interface PoultryBatchView extends FarmScope, ProductionRecord, Omit<PoultryBatchFields, "breed"> {
  batchId: string;
  animalTypeName: string;
  breed: string | null;
  currentQuantity: number;
  currentQuantitySource: CurrentQuantitySource;
  status: ProductionStatus;
}

/**
 * Implemented in T008; application authorization precedes all calls.
 * Farm-record reads constrain tenant AND farm, including nested IDs and pagination anchors.
 * Animal types are global data-catalog entries (D-P03-010); the service authorizes farm access before lookup.
 * startPoultryBatch must recheck current membership, resolve the POULTRY enterprise and an active
 * catalog animal type, and reuse assertPoultryBatchStart. The batch label key is unique per farm
 * across ALL statuses; a duplicate is CONFLICT. Initial state is ACTIVE/version 1 and the
 * current count derives from the starting count (STARTING_COUNT) until Phase 5 movements exist.
 * Persist the row and atomic actor/scope/request audit receipt together. Identical normalized
 * retries replay; a changed command or farm conflicts; failures roll back both.
 * Movements, closure, catalog administration and durable offline sync are separate scope.
 */
export interface PoultryBatchRepository {
  animalTypes(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<{ animalTypeId: string; name: string }>>;
  poultryBatch(scope: FarmScope, batchId: string): Promise<PoultryBatchView | null>;
  poultryBatches(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<PoultryBatchView>>;
  startPoultryBatch(scope: ProductionWriteScope, command: StartPoultryBatch): Promise<PoultryBatchView>;
}
