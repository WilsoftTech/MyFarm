"use server";
import { redirect } from "next/navigation";
import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { logSafe } from "@/modules/engineering-foundation/infrastructure/logging";

export type CommandFailure = { ok: false; message: string };
// Exhaustive over FoundationError codes so a new code cannot reach users as "undefined".
const messages: Record<FoundationError["code"], string> = {
UNAUTHENTICATED: "Your session has ended. Sign in again, then retry.",
FORBIDDEN: "You do not have access to this record.",
INVALID_INPUT: "Check the details you entered and try again.",
CONFLICT: "This was changed elsewhere. Reload the page to see the latest details.",
UNAVAILABLE: "MyFarm is unavailable right now. Your details are still here. Try again.",
RATE_LIMITED: "Too many attempts. Wait a minute, then try again. Your details are still here.",
};

async function run(work: () => Promise<string>, conflict?: string | (() => never)): Promise<CommandFailure> {
let destination: string;
try { destination = await work(); }
catch (error) {
const code = error instanceof FoundationError ? error.code : "UNAVAILABLE";
logSafe({ event: "request_failed", requestId: crypto.randomUUID(), code });
if (code === "CONFLICT" && typeof conflict === "function") conflict();
return { ok: false, message: code === "CONFLICT" && typeof conflict === "string" ? conflict : messages[code] };
}
redirect(destination);
}

export async function registerFarmerAction(input: unknown) {
return run(async () => { await farmerRegistryService().register(input); return "/farms"; }, () => redirect("/farmer"));
}
export async function updateProfileAction(input: unknown) {
return run(async () => { await farmerRegistryService().updateProfile(input); return "/farmer?updated=1"; }, "Your profile was changed elsewhere. Reload the page to see the latest details.");
}
export async function createFarmAction(input: unknown) {
return run(async () => "/farms/" + (await farmerRegistryService().createFarm(input)).farmId);
}
export async function createPlotAction(farmId: string, input: unknown) {
return run(async () => { await farmerRegistryService().createPlot(farmId, input); return "/farms/" + farmId + "?plot=added"; }, "A plot with this name already exists on this farm.");
}
