"use server";
import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";

export async function acknowledgeInsight(farmId: string, insightId: string, version: number, input: unknown) {
  return runServerCommand(async () => {
    const fields = typeof input === "object" && input !== null ? input : {};
    await farmIntelligenceService().acknowledge(farmId, insightId, { ...fields, expectedVersion: version });
    return "/farms/" + farmId + "/insights?seen=" + insightId;
  }, "This alert changed since the page opened. Reload to see the latest.");
}
