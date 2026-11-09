"use server";
import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

/** A wrong, closed or ended code is refused without saying which, so the farmer gets one plain message. */
export async function joinPilotAction(input: unknown) {
  return runServerCommand(async () => {
    try { await fieldPilotService().join(input); }
    catch (error) { if (error instanceof FoundationError && error.code === "FORBIDDEN") throw new FoundationError("INVALID_INPUT"); throw error; }
    return "/pilot?joined=1";
  }, "You left this pilot, so you cannot join it again.", "That code was not accepted. Check it with the MyFarm team, and tick the box to agree.");
}

export async function leavePilotAction(participationId: string, input: unknown) {
  return runServerCommand(async () => {
    await fieldPilotService().withdraw(participationId, input);
    return "/pilot?left=1";
  }, "This changed elsewhere. Reload the page to see whether you are still in the pilot.");
}
