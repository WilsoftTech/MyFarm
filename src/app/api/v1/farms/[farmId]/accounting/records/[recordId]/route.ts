import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; recordId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, recordId } = await context.params;
    return Response.json({ record: await farmAccountingService().record(farmId, recordId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
