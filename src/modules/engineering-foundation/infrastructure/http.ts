import { FoundationError } from "../domain/errors";
import { logSafe } from "./logging";
export function failureResponse(error: unknown, requestId: string) {
const code = error instanceof FoundationError ? error.code : "UNAVAILABLE";
const status = { UNAUTHENTICATED: 401, FORBIDDEN: 403, INVALID_INPUT: 400, UNAVAILABLE: 503, CONFLICT: 409 }[code];
logSafe({ event: "request_failed", requestId, code });
return Response.json({ error: code, requestId }, { status, headers: { "Cache-Control": "no-store" } });
}
