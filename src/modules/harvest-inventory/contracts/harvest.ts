import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate, type FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ProductionPage, ProductionPageInput, ProductionRecord, ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { normalizeHarvestQuantity, quantityUnits, type HarvestFields } from "../domain/harvest";

const quantity = z.string().trim().transform((value, context) => {
  const normalized = normalizeHarvestQuantity(value);
  if (normalized === null) {
    context.addIssue({ code: "custom", message: "Use up to 12 whole digits and 6 decimal places." });
    return z.NEVER;
  }
  return normalized;
});
/** Scope, actor and computed stock are server-owned. requestId follows existing retry contracts. */
export const recordHarvestSchema = z.object({
  requestId: idSchema,
  cropCycleId: idSchema,
  cropId: idSchema,
  plotId: idSchema,
  storageLocationId: idSchema,
  harvestDate: z.string().refine(isCalendarDate, "Enter a valid date as YYYY-MM-DD."),
  quantity: quantity.refine(value => quantityUnits(value) > 0n, "Enter a quantity greater than zero."),
  unit: z.literal("KG", { error: "Choose kilograms." }),
  grade: z.string().trim().max(120).optional().transform(value => value || undefined),
  lossQuantity: quantity.default("0"),
}).strict().refine(value => quantityUnits(value.lossQuantity) <= quantityUnits(value.quantity), {
  message: "Loss cannot exceed the harvested quantity.", path: ["lossQuantity"],
});
export type RecordHarvest = z.output<typeof recordHarvestSchema>;
export interface HarvestView extends FarmScope, ProductionRecord, Omit<HarvestFields, "grade"> {
  harvestId: string;
  cropName: string;
  storageLocationName: string;
  grade: string | null;
  storedQuantity: string;
}

/**
 * T002 port only. Every read constrains tenant AND farm, including pagination anchors.
 * Writes recheck current farm membership and resolve cycle/plot/storage in the transaction.
 * Crop identity comes from the cycle; never trust a supplied crop/plot match.
 * Append gross harvest and separate initial loss effects atomically with audit/receipt.
 * No income is recognized by harvest. No mutable stock balance is authoritative.
 * Bind retries to actor, farm, operation and normalized payload; changed intent conflicts.
 * A rollback leaves no harvest, stock effect or receipt. Historical cycle references do not
 * reopen cycles or seasons. Later losses/corrections append history rather than edit this row.
 * Device/outbox synchronization remains Phase 7; requestId does not implement offline sync.
 */
export interface HarvestRepository {
  harvest(scope: FarmScope, harvestId: string): Promise<HarvestView | null>;
  harvests(scope: FarmScope, page: ProductionPageInput): Promise<ProductionPage<HarvestView>>;
  recordHarvest(scope: ProductionWriteScope, command: RecordHarvest): Promise<HarvestView>;
}
