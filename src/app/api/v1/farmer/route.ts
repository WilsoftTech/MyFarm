import { farmerRegistryService } from "@/modules/farmer-registry/infrastructure/services";
import { commandBody, privateHeaders } from "@/modules/farmer-registry/infrastructure/http";
import { failureResponse } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET() {
const requestId = crypto.randomUUID();
try { return Response.json({ farmer: await farmerRegistryService().currentFarmer() }, { headers: privateHeaders }); }
catch (error) { return failureResponse(error, requestId); }
}
export async function POST(request: Request) {
const requestId = crypto.randomUUID();
try { return Response.json({ farmer: await farmerRegistryService().register(await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
catch (error) { return failureResponse(error, requestId); }
}
export async function PATCH(request: Request) {
const requestId = crypto.randomUUID();
try { return Response.json({ farmer: await farmerRegistryService().updateProfile(await commandBody(request)) }, { headers: privateHeaders }); }
catch (error) { return failureResponse(error, requestId); }
}
