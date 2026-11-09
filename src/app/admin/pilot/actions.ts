"use server";
import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";

/** Staff actions; the organization and cohort are bound arguments, still checked by the service. */
const cohortPath = (scopeId: string, cohortId: string, saved: string) => "/admin/pilot/" + encodeURIComponent(cohortId) + "?scope=" + encodeURIComponent(scopeId) + "&saved=" + saved;

export async function createCohortAction(scopeId: string, input: unknown) {
  return runServerCommand(async () => cohortPath(scopeId, (await fieldPilotService().createCohort(scopeId, input)).cohortId, "cohort"));
}
export async function recordPromptAction(scopeId: string, cohortId: string, input: unknown) {
  return runServerCommand(async () => { await fieldPilotService().recordPrompt(scopeId, cohortId, input); return cohortPath(scopeId, cohortId, "prompt"); });
}
export async function openIncidentAction(scopeId: string, cohortId: string, input: unknown) {
  return runServerCommand(async () => { await fieldPilotService().openIncident(scopeId, cohortId, input); return cohortPath(scopeId, cohortId, "incident"); });
}
export async function resolveIncidentAction(scopeId: string, cohortId: string, incidentId: string, input: unknown) {
  return runServerCommand(async () => { await fieldPilotService().resolveIncident(scopeId, cohortId, incidentId, input); return cohortPath(scopeId, cohortId, "resolved"); }, "This incident changed elsewhere. Reload the page.");
}
export async function recordPaperConsentAction(scopeId: string, cohortId: string, participationId: string, input: unknown) {
  return runServerCommand(async () => { await fieldPilotService().recordPaperConsent(scopeId, cohortId, participationId, input); return cohortPath(scopeId, cohortId, "consent"); }, "This changed elsewhere. Reload the page.");
}
