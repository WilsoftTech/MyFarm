import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { commandBody, privateHeaders } from "@/modules/farmer-registry/infrastructure/http";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ farmId: string }> }) {
const requestId = crypto.randomUUID();
try {
const body = await commandBody(request);
return Response.json(await farmerRegistryService().createPlot((await context.params).farmId, body), { status: 201, headers: privateHeaders });
} catch (error) { return failureResponse(error, requestId); }
}
