import { z } from "zod";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { recordSaleSchema } from "@/modules/farm-accounting/contracts/accounting";
import { normalizeHarvestQuantity, quantityUnits } from "../domain/harvest";
const quantity = z.string().trim().transform((value, ctx) => {
  const q = normalizeHarvestQuantity(value);
  if (q === null || quantityUnits(q) === 0n) { ctx.addIssue({ code: "custom", message: "Enter a quantity above zero with up to six decimal places." }); return z.NEVER; }
  return q;
});
const unit = z.string().trim().min(1).max(20);
const reason = z.string().trim().min(1).max(500);
export const createItemSchema = z.object({ requestId: idSchema, name: z.string().trim().min(1).max(120), unit }).strict();
export const stockOperationSchema = z.object({
  requestId: idSchema, itemId: idSchema, locationId: idSchema, type: z.enum(["SALE", "LOSS", "TRANSFER", "ADJUSTMENT"]), quantity, unit,
  occurredOn: z.string().refine(isCalendarDate), destinationLocationId: idSchema.optional(), direction: z.enum(["IN", "OUT"]).optional(), reason,
  sale: recordSaleSchema.pick({ categoryId: true, amount: true, currency: true, counterparty: true }).optional(),
}).strict().superRefine((v, ctx) => {
  if ((v.type === "TRANSFER") !== Boolean(v.destinationLocationId) || v.destinationLocationId === v.locationId) ctx.addIssue({ code: "custom", message: "A transfer needs a different destination store.", path: ["destinationLocationId"] });
  if ((v.type === "ADJUSTMENT") !== Boolean(v.direction)) ctx.addIssue({ code: "custom", message: "Choose an adjustment direction only for adjustments.", path: ["direction"] });
  if ((v.type === "SALE") !== Boolean(v.sale)) ctx.addIssue({ code: "custom", message: "Only sales require accounting details.", path: ["sale"] });
});
export const reverseStockSchema = z.object({ requestId: idSchema, targetType: z.enum(["HARVEST", "PRODUCTION", "OPERATION"]), targetId: idSchema, reason,
  occurredOn: z.string().refine(isCalendarDate), confirmed: z.literal(true) }).strict();
export type CreateItem = z.output<typeof createItemSchema>;
export type StockOperation = z.output<typeof stockOperationSchema>;
export type ReverseStock = z.output<typeof reverseStockSchema>;
export interface StockItemView { itemId: string; name: string; unit: string; kind: string; balances: { locationId: string; locationName: string; quantity: string }[] }
export interface StockOperationView { operationId: string; type: string; itemId: string | null; quantity: string; unit: string; occurredOn: string; reason: string; accountingRecordId: string | null }
export interface StockRepository {
  operation(scope: import("@/modules/enterprises-seasons/domain/production").FarmScope, id: string): Promise<StockOperationView | null>;
  operations(scope: import("@/modules/enterprises-seasons/domain/production").FarmScope, page: import("@/modules/enterprises-seasons/contracts/production").ProductionPageInput): Promise<import("@/modules/enterprises-seasons/contracts/production").ProductionPage<StockOperationView>>;
  createItem(scope: import("@/modules/enterprises-seasons/contracts/production").ProductionWriteScope, input: CreateItem): Promise<StockItemView>;
  items(scope: import("@/modules/enterprises-seasons/domain/production").FarmScope, page: import("@/modules/enterprises-seasons/contracts/production").ProductionPageInput): Promise<import("@/modules/enterprises-seasons/contracts/production").ProductionPage<StockItemView>>;
  post(scope: import("@/modules/enterprises-seasons/contracts/production").ProductionWriteScope, input: StockOperation): Promise<StockOperationView>;
  reverse(scope: import("@/modules/enterprises-seasons/contracts/production").ProductionWriteScope, input: ReverseStock): Promise<StockOperationView>;
}
