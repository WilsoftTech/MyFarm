import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { commandBody, privateHeaders } from "@/modules/farmer-registry/infrastructure/http";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
const requestId = crypto.randomUUID();
try {
const params = new URL(request.url).searchParams;
const page = { ...(params.has("cursor") ? { cursor: params.get("cursor") } : {}), ...(params.has("limit") ? { limit: Number(params.get("limit")) } : {}) };
return Response.json(await farmerRegistryService().listFarms(page), { headers: privateHeaders });
} catch (error) { return failureResponse(error, requestId); }
}
export async function POST(request: Request) {
const requestId = crypto.randomUUID();
try { return Response.json(await farmerRegistryService().createFarm(await commandBody(request)), { status: 201, headers: privateHeaders }); }
catch (error) { return failureResponse(error, requestId); }
}
