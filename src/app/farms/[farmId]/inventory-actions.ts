"use server";
import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { cropCycleService, poultryBatchService } from "@/modules/enterprises-seasons/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { ChoicePage } from "@/components/production/choice-types";

export async function inventoryChoices(farmId: string, kind: string, cursor?: string): Promise<ChoicePage> {
  const input = cursor ? { cursor } : {};
  if (kind === "cycles") {
    const page = await cropCycleService().list(farmId, input);
    return { items: page.items.map(r => ({ id: r.cycleId, label: r.cropName + " - planted " + r.plantingDate + " - " + r.cycleId.slice(0, 8) })), nextCursor: page.nextCursor };
  }
  if (kind === "locations") {
    const page = await harvestService().locations(farmId, input);
    return { items: page.items.map(r => ({ id: r.storageLocationId, label: r.name })), nextCursor: page.nextCursor };
  }
  if (kind === "batches") {
    const p = await poultryBatchService().list(farmId, input);
    return { items: p.items.map(r => ({ id: r.batchId, label: r.batchLabel })), nextCursor: p.nextCursor };
  }
  if (kind === "revenue-categories") {
    const { farmAccountingService } = await import("@/modules/farm-accounting/infrastructure/services");
    const p = await farmAccountingService().categories(farmId, { ...input, kind: "REVENUE" });
    return { items: p.items.map(r => ({ id: r.categoryId, label: r.name })), nextCursor: p.nextCursor };
  }
  throw new FoundationError("INVALID_INPUT");
}
export async function moreInventoryChoices(farmId: string, kind: string, cursor: string) {
  try { return { ok: true as const, page: await inventoryChoices(farmId, kind, cursor) }; }
  catch { return { ok: false as const, message: "Choices could not be loaded. Retry after checking your connection and farm access." }; }
}
export async function saveHarvest(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    // Resolve dependent crop and plot under current authorization; the form only chooses a cycle.
    const { z } = await import("zod");
    const fields = z.object({ requestId: z.string(), cropCycleId: z.string(), storageLocationId: z.string(), harvestDate: z.string(), quantity: z.string(), lossQuantity: z.string(), grade: z.string().optional() }).strict().safeParse(input);
    if (!fields.success) throw new FoundationError("INVALID_INPUT");
    const cycle = await cropCycleService().cycle(farmId, fields.data.cropCycleId);
    const row = await harvestService().record(farmId, { ...fields.data, cropId: cycle.cropId, plotId: cycle.plotId, unit: "KG" });
    return "/farms/" + farmId + "/harvests/" + row.harvestId;
  }, "This request conflicts with an existing record. Reload to check it.", "Check the harvest date, kilograms and losses. Loss cannot exceed the harvested quantity.");
}
export async function saveStorage(farmId: string, input: unknown) {
  return runServerCommand(async () => { await harvestService().createLocation(farmId, input); return "/farms/" + farmId + "/storage-locations"; }, "A store with this name already exists on this farm.");
}

export async function savePoultryEvent(farmId: string, input: unknown) {
 return runServerCommand(async () => {
  const { z } = await import("zod");
  const parsed = z.object({ requestId:z.string(), batchId:z.string(), locationId:z.string(),type:z.string(),quantity:z.string(),unit:z.string(),occurredOn:z.string(),note:z.string().optional(),categoryId:z.string().optional(),amount:z.string().optional(),currency:z.string().optional() }).strict().safeParse(input);
  if (!parsed.success) throw new FoundationError("INVALID_INPUT");
  const { categoryId,amount,currency,...fields } = parsed.data;
  if (fields.type !== "BIRD_SALE" && (categoryId || amount || currency)) throw new FoundationError("INVALID_INPUT");
  const { poultryProductionService } = await import("@/modules/harvest-inventory/infrastructure/services");
  await poultryProductionService().record(farmId, { ...fields, ...(fields.type === "BIRD_SALE" ? {sale:{categoryId,amount,currency}} : {}) });
  return "/farms/" + farmId + "/poultry-production/" + fields.batchId;
 }, "Not enough birds at this location, or the request conflicts. Reload and check the flock.", "Check the event, date, quantity and unit. Bird sales also need category, amount and currency.");
}
