import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate, type FarmScope, type ProductionStatus } from "../domain/production";
import { normalizeBirdCount, type BatchQuantity, type PoultryBatchFields } from "../domain/poultry-batch";
import { poultryBatchLinksSchema, type ProductionPage, type ProductionPageInput, type ProductionRecord, type ProductionWriteScope } from "./production";

const date = z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD.");
const text = (label: string) => z.string().trim().min(1, "Enter " + label + ".").max(120, "Use 120 characters or fewer.");
const optionalText = (max: number) => z.string().trim().max(max, "Use " + max + " characters or fewer.").optional().transform(value => value || undefined);

/** The enterprise ID is an untrusted reference; tenant, actor, status, version and current quantity are server-owned. */
export const startPoultryBatchSchema = poultryBatchLinksSchema.extend({
  requestId: idSchema,
  batchName: text("a batch name"),
  animalType: text("the type of bird"),
  breed: optionalText(120),
  startingQuantity: z.string().trim().transform((value, context) => {
    const normalized = normalizeBirdCount(value);
    if (normalized === null) { context.addIssue({ code: "custom", message: "Enter the number of birds as a whole number, 0 or more." }); return z.NEVER; }
    return normalized;
  }),
  acquisitionDate: date,
  purpose: text("a production purpose"),
}).strict();
export type StartPoultryBatch = z.output<typeof startPoultryBatchSchema>;

export interface PoultryBatchView extends FarmScope, ProductionRecord, Omit<PoultryBatchFields, "breed"> {
  batchId: string;
  breed: string | null;
  currentQuantity: BatchQuantity;
  status: ProductionStatus;
}

/**
 * Implemented in T008 (infrastructure/poultry-batch-repository.ts); application authorization precedes all calls.
 * Reads constrain tenant AND farm, including the batch ID and pagination anchors.
 * startPoultryBatch must authenticate/recheck current membership, resolve the enterprise inside
 * the write transaction and reuse assertPoultryBatchStart. Persist the batch with an atomic
 * actor/scope/request audit receipt; initial state is ACTIVE/version 1. Identical normalized
 * retries replay the original batch; a changed command or farm conflicts. Distinct requests
 * create distinct batches even with identical fields. Failures roll back both row and receipt.
 * currentQuantity comes from currentBatchQuantity, never a stored, overwritable count.
 * Movements, mortality, closure and durable offline sync are separate scope.
 */
export interface PoultryBatchRepository {
  poultryBatch(scope: FarmScope, batchId: string): Promise<PoultryBatchView | null>;
  poultryBatches(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<PoultryBatchView>>;
  startPoultryBatch(scope: ProductionWriteScope, command: StartPoultryBatch): Promise<PoultryBatchView>;
}
