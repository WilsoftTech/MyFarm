import "server-only";
import { cropCycleService, productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { areaUnitLabels } from "@/components/farmer-registry/labels";
import type { CropChoiceKind, CropChoicePage } from "./crop-choice-types";

export async function loadCropChoices(farmId: string, kind: CropChoiceKind, cursor?: string): Promise<CropChoicePage> {
  const page = { cursor };
  if (kind === "enterprises") {
    const result = await productionService().listEnterprises(farmId, page);
    return { ...result, items: result.items.map(row => ({ id: row.enterpriseId, label: row.name + (row.type !== "CROP" ? " — not a crop enterprise" : row.status !== "ACTIVE" ? " — closed" : ""), disabled: row.type !== "CROP" || row.status !== "ACTIVE" })) };
  }
  if (kind === "seasons") {
    const result = await productionService().listSeasons(farmId, page);
    return { ...result, items: result.items.map(row => ({ id: row.seasonId, label: row.label + (row.status !== "ACTIVE" ? " — closed" : ""), disabled: row.status !== "ACTIVE" })) };
  }
  if (kind === "plots") {
    const result = await cropCycleService().plots(farmId, page);
    return { ...result, items: result.items.map(row => ({ id: row.plotId, label: row.name + (row.area === null || row.areaUnit === null ? " — area not recorded" : " — " + row.area + " " + areaUnitLabels[row.areaUnit]), disabled: row.area === null || row.areaUnit === null, areaUnit: row.areaUnit ?? undefined })) };
  }
  const result = await cropCycleService().crops(farmId, page);
  return { ...result, items: result.items.map(row => ({ id: row.cropId, label: row.name })) };
}
