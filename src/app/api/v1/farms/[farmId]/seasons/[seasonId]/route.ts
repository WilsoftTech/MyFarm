import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; seasonId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, seasonId } = await context.params;
    return Response.json({ season: await productionService().season(farmId, seasonId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
