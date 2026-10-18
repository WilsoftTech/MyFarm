import { cropCycleService } from "@/modules/enterprises-seasons/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; cycleId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, cycleId } = await context.params;
    return Response.json({ cycle: await cropCycleService().cycle(farmId, cycleId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
