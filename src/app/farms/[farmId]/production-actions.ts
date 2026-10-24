"use server";
import { cropCycleService, poultryBatchService, productionService, productionClosureService } from "@/modules/enterprises-seasons/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { loadCropChoices } from "@/components/production/crop-choices";
import { loadPoultryChoices } from "@/components/production/poultry-choices";
import type { CropChoiceKind, CropChoiceLoad, PoultryChoiceKind, PoultryChoiceLoad } from "@/components/production/choice-types";
import type { ClosureKind } from "@/modules/enterprises-seasons/contracts/closure";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

export async function closeProductionAction(farmId: string, kind: ClosureKind, recordId: string, input: unknown) {
  return runServerCommand(async () => {
    // Bound action arguments are still untrusted: only these two workflows exist.
    if (kind !== "SEASON" && kind !== "CROP_CYCLE") throw new FoundationError("INVALID_INPUT");
    await productionClosureService().close(farmId, kind, recordId, input);
    return "/farms/" + farmId + (kind === "SEASON" ? "/seasons/" : "/crop-cycles/") + recordId + "?closed=1";
  }, kind === "SEASON" ? "Close every active crop cycle in this season first. If this season was changed elsewhere, reload and check its status." : "This crop cycle was changed elsewhere. Reload and check its status.");
}

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
export async function startPoultryBatchAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await poultryBatchService().start(farmId, input);
    return "/farms/" + row.farmId + "/poultry-batches/" + row.batchId + "?saved=1";
  }, "This batch was not saved. Another batch on this farm may already use this name, so choose a different name. Also check that the enterprise and animal type are still active.", "Check the batch details. Enter a whole number of birds, 0 or more, and a valid acquisition date.");
}
export async function morePoultryChoicesAction(farmId: string, kind: PoultryChoiceKind, cursor: string): ReturnType<PoultryChoiceLoad> {
  try {
    if (!["enterprises", "animal-types"].includes(kind)) {
      await productionService().farmContext(farmId);
      return { ok: false, message: "Choose a valid list." };
    }
    return { ok: true, page: await loadPoultryChoices(farmId, kind, cursor) };
  }
  catch { return { ok: false, message: "Could not load more choices. Check your access and connection, then try again. Your details are still here." }; }
}
export async function createSeasonAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await productionService().createSeason(farmId, input);
    return "/farms/" + row.farmId + "/seasons/" + row.seasonId + "?saved=1";
  });
}
