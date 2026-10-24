import "server-only";
import { poultryBatchService, productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import type { ChoicePage, PoultryChoiceKind } from "./choice-types";
import { enterpriseChoice } from "./enterprise-choice";

export async function loadPoultryChoices(farmId: string, kind: PoultryChoiceKind, cursor?: string): Promise<ChoicePage> {
  const page = { cursor };
  if (kind === "enterprises") {
    const result = await productionService().listEnterprises(farmId, page);
    return { ...result, items: result.items.map(row => enterpriseChoice(row, "POULTRY_BATCH")) };
  }
  const result = await poultryBatchService().animalTypes(farmId, page);
  return { ...result, items: result.items.map(row => ({ id: row.animalTypeId, label: row.name })) };
}
