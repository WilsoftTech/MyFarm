"use server";
import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";

/** D-P10-007: saves the supply item a batch is fed from; the server checks it is a supply of this farm. */
export async function saveFeedItem(farmId: string, batchId: string, version: number | null, input: unknown) {
  return runServerCommand(async () => {
    const fields = typeof input === "object" && input !== null ? input : {};
    await farmIntelligenceService().setFeedItem(farmId, batchId, { ...fields, expectedVersion: version });
    return "/farms/" + farmId + "/poultry-batches/" + batchId + "?feed=saved";
  }, "The feed item was changed since this page opened, or the batch is closed. Reload to see the latest.", "Choose a supply item from this farm's stock.");
}
