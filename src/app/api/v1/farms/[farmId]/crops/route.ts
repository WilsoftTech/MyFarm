import { cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ farmId: string }> }) {
  const requestId = crypto.randomUUID();
  try { return Response.json(await cropCycleService().crops((await context.params).farmId, productionPageInput(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, requestId); }
}
