import { farmAccountingService } from "@/modules/farm-accounting/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; paymentId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, paymentId } = await context.params;
    return Response.json({ payment: await farmAccountingService().payment(farmId, paymentId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
