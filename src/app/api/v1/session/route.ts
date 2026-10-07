import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET() {
const requestId = crypto.randomUUID();
try { return Response.json(await authorizationService().overview(), { headers: { "Cache-Control": "private, no-store" } }); }
catch (error) { return failureResponse(error, requestId); }
}
