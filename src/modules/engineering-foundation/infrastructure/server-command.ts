import "server-only";
import { redirect } from "next/navigation";
import { FoundationError } from "../domain/errors";
import type { CommandFailure } from "../contracts/command-result";
import { logSafe } from "./logging";

const messages: Record<FoundationError["code"], string> = {
  UNAUTHENTICATED: "Your session has ended. Sign in again, then retry.",
  FORBIDDEN: "You do not have access to this record.",
  INVALID_INPUT: "Check the details you entered and try again.",
  CONFLICT: "This was changed elsewhere. Reload the page to see the latest details.",
  UNAVAILABLE: "MyFarm is unavailable right now. Your details are still here. Try again.",
  RATE_LIMITED: "Too many attempts. Wait a minute, then try again. Your details are still here.",
};

/** Redirect only after the service commits; preserve input with safe feedback on failure. */
export async function runServerCommand(work: () => Promise<string>, conflict?: string | (() => never)): Promise<CommandFailure> {
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
