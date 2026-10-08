import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { privateHeaders } from "@/modules/farmer-registry/infrastructure/http";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string }> }) {
const requestId = crypto.randomUUID();
try { return Response.json({ farm: await farmerRegistryService().farm((await context.params).farmId) }, { headers: privateHeaders }); }
catch (error) { return failureResponse(error, requestId); }
}
