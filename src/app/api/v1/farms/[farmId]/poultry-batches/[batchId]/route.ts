import { poultryBatchService } from "@/modules/enterprises-seasons/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; batchId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, batchId } = await context.params;
    return Response.json({ batch: await poultryBatchService().batch(farmId, batchId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
