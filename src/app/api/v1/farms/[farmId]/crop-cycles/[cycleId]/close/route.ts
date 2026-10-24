import { productionClosureService } from "@/modules/enterprises-seasons/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ farmId: string; cycleId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const body = await commandBody(request), { farmId, cycleId } = await context.params;
    return Response.json(await productionClosureService().close(farmId, "CROP_CYCLE", cycleId, body), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
