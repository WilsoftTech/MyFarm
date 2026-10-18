"use server";
import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";

export async function createEnterpriseAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await productionService().createEnterprise(farmId, input);
    return "/farms/" + row.farmId + "/enterprises/" + row.enterpriseId + "?saved=1";
  });
}
export async function createSeasonAction(farmId: string, input: unknown) {
  return runServerCommand(async () => {
    const row = await productionService().createSeason(farmId, input);
    return "/farms/" + row.farmId + "/seasons/" + row.seasonId + "?saved=1";
  });
}
