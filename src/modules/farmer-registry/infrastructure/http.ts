import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { requireSameOrigin } from "@/modules/engineering-foundation/infrastructure/http";

export const privateHeaders = { "Cache-Control": "private, no-store" };

/** Same-origin JSON command body. Uses the Phase1 origin policy shared with private-file grants (Host only, never X-Forwarded-Host). */
export async function commandBody(request: Request): Promise<unknown> {
requireSameOrigin(request);
if (!request.headers.get("content-type")?.startsWith("application/json")) throw new FoundationError("INVALID_INPUT");
try { return await request.json(); } catch { throw new FoundationError("INVALID_INPUT"); }
}
