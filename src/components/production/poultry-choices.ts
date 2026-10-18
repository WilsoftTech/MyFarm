import "server-only";
import { poultryBatchService, productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import type { ChoicePage, PoultryChoiceKind } from "./choice-types";

export async function loadPoultryChoices(farmId: string, kind: PoultryChoiceKind, cursor?: string): Promise<ChoicePage> {
  const page = { cursor };
  if (kind === "enterprises") {
    const result = await productionService().listEnterprises(farmId, page);
    return { ...result, items: result.items.map(row => ({ id: row.enterpriseId, label: row.name + (row.type !== "POULTRY" ? " — not a poultry enterprise" : row.status !== "ACTIVE" ? " — closed" : ""), disabled: row.type !== "POULTRY" || row.status !== "ACTIVE" })) };
  }
  const result = await poultryBatchService().animalTypes(farmId, page);
  return { ...result, items: result.items.map(row => ({ id: row.animalTypeId, label: row.name })) };
}
