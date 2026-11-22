"use server";
import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
export async function grantOfficerAction(farmId: string, input: unknown) {
  return runServerCommand(async () => { await officerServices().assignments.grant(farmId, input); return `/farms/${farmId}/officers?updated=1`; }, "This officer may already have access. Reload the page before trying again.");
}
export async function revokeOfficerAction(farmId: string, input: unknown) {
  return runServerCommand(async () => { await officerServices().assignments.revoke(farmId, input); return `/farms/${farmId}/officers?updated=1`; });
}
