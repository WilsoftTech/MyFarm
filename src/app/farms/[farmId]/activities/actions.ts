"use server";
import { activityService, recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { photoService } from "@/modules/offline-first/infrastructure/services";
import type { PhotoTarget } from "@/modules/offline-first/domain/commands";
import { RECURRING_ACTIVITY_TYPES } from "@/modules/farm-activities/domain/recurrence";
import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { activityUnavailableLabels } from "@/components/production/activity-labels";
import type { ChoicePage } from "@/components/production/choice-types";

const fields = (input: unknown) => {
  if (typeof input !== "object" || input === null) throw new FoundationError("INVALID_INPUT");
  return input;
};
export async function activityTypeChoices(farmId: string, enterpriseId?: string): Promise<ChoicePage> {
  const rows = await activityService().capabilities(farmId, enterpriseId ? { enterpriseId } : {});
  return { items: rows.map(row => ({ id: row.type, label: row.label + (row.reason ? " — " + activityUnavailableLabels[row.reason] : ""), disabled: !row.available })), nextCursor: null };
}
/** Any plot on the farm can host an activity, including one with no recorded area. */
export async function activityPlotChoices(farmId: string, cursor?: string): Promise<ChoicePage> {
  const page = await cropCycleService().plots(farmId, cursor ? { cursor } : {});
  return { items: page.items.map(row => ({ id: row.plotId, label: row.name })), nextCursor: page.nextCursor };
}
/** Only posted expenses and purchases can be linked; the service checks this again when saving. */
export async function activityCostChoices(farmId: string, cursor?: string): Promise<ChoicePage> {
  const page = await farmAccountingService().records(farmId, cursor ? { cursor } : {});
  return { items: page.items.filter(row => (row.kind === "EXPENSE" || row.kind === "PURCHASE") && row.status === "POSTED").map(row => ({ id: row.recordId, label: row.occurredOn + " · " + row.categoryName + " · " + row.amount + " " + row.currency })), nextCursor: page.nextCursor };
}
export async function moreActivityChoices(farmId: string, kind: string, cursor: string) {
  try {
    if (kind === "plots") return { ok: true as const, page: await activityPlotChoices(farmId, cursor) };
    if (kind === "costs") return { ok: true as const, page: await activityCostChoices(farmId, cursor) };
    throw new FoundationError("INVALID_INPUT");
  } catch { return { ok: false as const, message: "Choices could not be loaded. Retry after checking your connection and farm access." }; }
}
export async function saveActivity(farmId: string, enterpriseId: string | null, input: unknown) {
  return runServerCommand(async () => {
    const row = await activityService().schedule(farmId, { ...fields(input), ...(enterpriseId ? { enterpriseId } : {}) });
    return "/farms/" + farmId + "/activities/" + row.activityId;
  }, "This enterprise is closed, the chosen cost was reversed, or this request was already used. Reload to check it.", "Check the activity and due date. Some activities are not available for this enterprise.");
}
export async function saveActivityCompletion(farmId: string, activityId: string, version: number, input: unknown) {
  return runServerCommand(async () => {
    await activityService().complete(farmId, activityId, { ...fields(input), expectedVersion: version });
    return "/farms/" + farmId + "/activities/" + activityId;
  }, "This activity was already finished or changed. Reload to see the latest details.", "Check the worker name, notes and chosen cost.");
}
export async function saveActivityCancellation(farmId: string, activityId: string, input: unknown) {
  return runServerCommand(async () => {
    await activityService().cancel(farmId, activityId, input);
    return "/farms/" + farmId + "/activities/" + activityId;
  }, "This activity was already finished or changed. Reload to see the latest details.");
}
/** Only the source's recurring activities are offered, each with the same availability as a one-off activity. */
export async function recurringTypeChoices(farmId: string, enterpriseId?: string): Promise<ChoicePage> {
  const page = await activityTypeChoices(farmId, enterpriseId);
  return { items: page.items.filter(row => RECURRING_ACTIVITY_TYPES.some(type => type === row.id)), nextCursor: null };
}
/** Forms send text; the strict schema still validates the converted number. */
const withInterval = (input: unknown) => {
  const row = fields(input) as Record<string, unknown>;
  return { ...row, interval: Number(row.interval) };
};
export async function saveSeries(farmId: string, enterpriseId: string | null, input: unknown) {
  return runServerCommand(async () => {
    const row = await recurrenceService().create(farmId, { ...withInterval(input), ...(enterpriseId ? { enterpriseId } : {}) });
    return "/farms/" + farmId + "/activities/series/" + row.recurrenceId;
  }, "This enterprise is closed or this request was already used. Reload to check it.", "Check the activity, how often it repeats and the dates. A series starts today or later.");
}
export async function saveSeriesChange(farmId: string, seriesId: string, version: number, input: unknown) {
  return runServerCommand(async () => {
    const row = await recurrenceService().change(farmId, seriesId, { ...withInterval(input), expectedVersion: version });
    return "/farms/" + farmId + "/activities/series/" + row.recurrenceId;
  }, "This series was changed, or an activity on or after that date is already done. Reload, or choose a later date.", "Check how often it repeats and the dates. A change starts today or later.");
}
export async function saveSeriesStop(farmId: string, seriesId: string, version: number, input: unknown) {
  return runServerCommand(async () => {
    await recurrenceService().stop(farmId, seriesId, { ...fields(input), expectedVersion: version });
    return "/farms/" + farmId + "/activities/series/" + seriesId;
  }, "This series was already stopped or changed. Reload to see the latest details.", "Choose a stop date that is today or later.");
}
/** Null rather than an error, so a photo problem can never stop the record itself from opening. */
export async function recordPhotos(farmId: string, target: PhotoTarget, recordId: string) {
  try { return await photoService().list(farmId, { target, recordId }); } catch { return null; }
}
