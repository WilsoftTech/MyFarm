import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ farmId: string }> };
export async function GET(request: Request, context: Context) {
  try { return Response.json(await harvestService().locations((await context.params).farmId, productionPageInput(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function POST(request: Request, context: Context) {
  try { return Response.json({ location: await harvestService().createLocation((await context.params).farmId, await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
