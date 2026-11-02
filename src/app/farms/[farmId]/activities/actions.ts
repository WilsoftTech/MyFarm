"use server";
import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { activityUnavailableLabels } from "@/components/production/activity-labels";
import type { ChoicePage } from "@/components/production/choice-types";

export async function activityTypeChoices(farmId: string, enterpriseId?: string): Promise<ChoicePage> {
  const rows = await activityService().capabilities(farmId, enterpriseId ? { enterpriseId } : {});
  return { items: rows.map(row => ({ id: row.type, label: row.label + (row.reason ? " — " + activityUnavailableLabels[row.reason] : ""), disabled: !row.available })), nextCursor: null };
}
/** Any plot on the farm can host an activity, including one with no recorded area. */
export async function activityPlotChoices(farmId: string, cursor?: string): Promise<ChoicePage> {
  const page = await cropCycleService().plots(farmId, cursor ? { cursor } : {});
  return { items: page.items.map(row => ({ id: row.plotId, label: row.name })), nextCursor: page.nextCursor };
}
export async function moreActivityChoices(farmId: string, kind: string, cursor: string) {
  try {
    if (kind !== "plots") throw new FoundationError("INVALID_INPUT");
    return { ok: true as const, page: await activityPlotChoices(farmId, cursor) };
  } catch { return { ok: false as const, message: "Choices could not be loaded. Retry after checking your connection and farm access." }; }
}
export async function saveActivity(farmId: string, enterpriseId: string | null, input: unknown) {
  return runServerCommand(async () => {
    if (typeof input !== "object" || input === null) throw new FoundationError("INVALID_INPUT");
    const row = await activityService().schedule(farmId, { ...input, ...(enterpriseId ? { enterpriseId } : {}) });
    return "/farms/" + farmId + "/activities/" + row.activityId;
  }, "This enterprise is closed or this request was already used. Reload to check it.", "Check the activity and due date. Some activities are not available for this enterprise.");
}
