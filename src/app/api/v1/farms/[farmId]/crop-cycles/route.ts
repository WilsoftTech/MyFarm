import { cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ farmId: string }> };
export async function GET(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try { return Response.json(await cropCycleService().list((await context.params).farmId, productionPageInput(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, requestId); }
}
export async function POST(request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const body = await commandBody(request);
    return Response.json({ cycle: await cropCycleService().start((await context.params).farmId, body) }, { status: 201, headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
