import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

export const privateHeaders = { "Cache-Control": "private, no-store" };

// Compare Origin with the Host the browser used, as Next.js does for Server Actions.
// request.url is not reliable here: next start rewrites it to localhost regardless of the Host header.
function sameOrigin(request: Request) {
const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
if (!origin || !host) return false;
try { return new URL(origin).host === host; } catch { return false; }
}

/** Same-origin JSON command body. Cross-site browsers cannot forge Host/X-Forwarded-Host without a failing CORS preflight. */
export async function commandBody(request: Request): Promise<unknown> {
if (!sameOrigin(request)) throw new FoundationError("FORBIDDEN");
if (!request.headers.get("content-type")?.startsWith("application/json")) throw new FoundationError("INVALID_INPUT");
try { return await request.json(); } catch { throw new FoundationError("INVALID_INPUT"); }
}
