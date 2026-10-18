"use server";
import { cropCycleService, productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { loadCropChoices } from "@/components/production/crop-choices";
import type { CropChoiceKind, CropChoiceLoad } from "@/components/production/crop-choice-types";

export async function createEnterpriseAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await productionService().createEnterprise(farmId, input);
    return "/farms/" + row.farmId + "/enterprises/" + row.enterpriseId + "?saved=1";
  });
}

export async function startCropCycleAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await cropCycleService().start(farmId, input);
    return "/farms/" + row.farmId + "/crop-cycles/" + row.cycleId + "?saved=1";
  }, undefined, "Check the crop, dates and plot area. Use the plot's unit. If total planted area exceeds the plot, record a reason for the extra area.");
}
export async function moreCropChoicesAction(farmId: string, kind: CropChoiceKind, cursor: string): ReturnType<CropChoiceLoad> {
  try {
    if (!["enterprises", "seasons", "plots", "crops"].includes(kind)) {
      await productionService().farmContext(farmId);
      return { ok: false, message: "Choose a valid list." };
    }
    return { ok: true, page: await loadCropChoices(farmId, kind, cursor) };
  }
  catch { return { ok: false, message: "Could not load more choices. Check your access and connection, then try again. Your details are still here." }; }
}
export async function createSeasonAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await productionService().createSeason(farmId, input);
    return "/farms/" + row.farmId + "/seasons/" + row.seasonId + "?saved=1";
  });
}
