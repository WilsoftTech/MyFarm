import { productionService } from "@/modules/enterprises-seasons/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; enterpriseId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, enterpriseId } = await context.params;
    return Response.json({ enterprise: await productionService().enterprise(farmId, enterpriseId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
