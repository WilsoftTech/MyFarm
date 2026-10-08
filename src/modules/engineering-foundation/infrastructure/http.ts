import { FoundationError } from "../domain/errors";
import { logSafe } from "./logging";
export function requireSameOrigin(request: Request) {
const url = new URL(request.url);
const host = request.headers.get("host");
let expected = url.origin;
if (host) {
try {
// Next.js may normalize its internal URL to localhost. Host is the HTTP
// authority receiving the browser's cookies; do not trust forwarded-host.
const authority = new URL(url.protocol + "//" + host);
if (authority.username || authority.password || authority.pathname !== "/" || authority.search || authority.hash) throw new Error("Invalid authority");
expected = authority.origin;
} catch { throw new FoundationError("FORBIDDEN"); }
}
if (request.headers.get("origin") !== expected) throw new FoundationError("FORBIDDEN");
}
export function failureResponse(error: unknown, requestId: string) {
const code = error instanceof FoundationError ? error.code : "UNAVAILABLE";
const status = { UNAUTHENTICATED: 401, FORBIDDEN: 403, INVALID_INPUT: 400, UNAVAILABLE: 503, CONFLICT: 409, RATE_LIMITED: 429 }[code];
logSafe({ event: "request_failed", requestId, code });
return Response.json({ error: code, requestId }, { status, headers: { "Cache-Control": "no-store" } });
}
