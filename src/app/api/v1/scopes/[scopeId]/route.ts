import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ scopeId: string }> }) {
const requestId = crypto.randomUUID();
try { return Response.json(await authorizationService().scope((await context.params).scopeId), { headers: { "Cache-Control": "private, no-store" } }); }
catch (error) { return failureResponse(error, requestId); }
}
