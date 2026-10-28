import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { recordSaleSchema } from "@/modules/farm-accounting/contracts/accounting";
import { normalizeHarvestQuantity } from "../domain/harvest";
import { PRODUCTION_EVENT_TYPES, assertProductionQuantity } from "../domain/production";

export const productionEventSchema = z.object({
  requestId: idSchema, batchId: idSchema, locationId: idSchema,
  type: z.enum(PRODUCTION_EVENT_TYPES),
  quantity: z.string().trim().transform((value, ctx) => {
    const q = normalizeHarvestQuantity(value);
    if (q === null) { ctx.addIssue({ code: "custom", message: "Enter an exact quantity with up to six decimal places." }); return z.NEVER; }
    return q;
  }),
  unit: z.string().trim().min(1).max(20),
  occurredOn: z.string().refine(isCalendarDate),
  note: z.string().trim().max(500).optional(),
  sale: recordSaleSchema.pick({ categoryId: true, amount: true, currency: true, counterparty: true }).optional(),
}).strict().superRefine((value, ctx) => {
  try { assertProductionQuantity(value); } catch { ctx.addIssue({ code: "custom", message: "Check the quantity and unit for this event.", path: ["quantity"] }); }
  if ((value.type === "BIRD_SALE") !== Boolean(value.sale)) ctx.addIssue({ code: "custom", message: "A bird sale needs its sale amount and category; other events cannot post a sale.", path: ["sale"] });
});
export type RecordProductionEvent = z.output<typeof productionEventSchema>;

export interface ProductionEventView { eventId: string; batchId: string; type: string; quantity: string; unit: string; occurredOn: string; note: string | null; accountingRecordId: string | null }
export interface FlockSummary { batchId: string; startingQuantity: number; currentQuantity: number; asOf: string; events: ProductionEventView[]; historyTruncated: boolean }
export interface PoultryProductionRepository {
  event(scope: import("@/modules/enterprises-seasons/domain/production").FarmScope, id: string): Promise<ProductionEventView | null>;
  record(scope: import("@/modules/enterprises-seasons/contracts/production").ProductionWriteScope, input: RecordProductionEvent): Promise<ProductionEventView>;
  summary(scope: import("@/modules/enterprises-seasons/domain/production").FarmScope, batchId: string): Promise<FlockSummary>;
}
