"use server";
import { fieldPilotService, pilotEvidenceService } from "@/modules/field-pilot/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";

/** Staff actions; the organization and cohort are bound arguments, still checked by the service. */
/** `at` changes on every save, so the page starts its forms afresh instead of keeping what was just saved. */
const at = () => "&at=" + crypto.randomUUID();
const cohortPath = (scopeId: string, cohortId: string, saved: string) => "/admin/pilot/" + encodeURIComponent(cohortId) + "?scope=" + encodeURIComponent(scopeId) + "&saved=" + saved + at();

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

const evidencePath = (scopeId: string, cohortId: string, saved: string) => "/admin/pilot/" + encodeURIComponent(cohortId) + "/evidence?scope=" + encodeURIComponent(scopeId) + "&saved=" + saved + at();
export async function recordObservationAction(scopeId: string, cohortId: string, input: unknown) {
  return runServerCommand(async () => { await pilotEvidenceService().recordObservation(scopeId, cohortId, input); return evidencePath(scopeId, cohortId, "observation"); });
}
export async function createFindingAction(scopeId: string, cohortId: string, input: unknown) {
  return runServerCommand(async () => { await pilotEvidenceService().createFinding(scopeId, cohortId, input); return evidencePath(scopeId, cohortId, "finding"); }, undefined, "A finding needs at least one observation that still stands. Tick one or more.");
}
export async function closeFindingAction(scopeId: string, cohortId: string, findingId: string, input: unknown) {
  return runServerCommand(async () => { await pilotEvidenceService().closeFinding(scopeId, cohortId, findingId, input); return evidencePath(scopeId, cohortId, "closed"); }, "This finding changed elsewhere. Reload the page.");
}
export async function recordReviewAction(scopeId: string, cohortId: string, input: unknown) {
  return runServerCommand(async () => { await pilotEvidenceService().recordReview(scopeId, cohortId, input); return evidencePath(scopeId, cohortId, "review"); }, "The figures changed and no longer allow that decision. Reload the page to see what they allow now.");
}
