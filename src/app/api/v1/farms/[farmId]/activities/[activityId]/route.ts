import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; activityId: string }> }) {
  try { const { farmId, activityId } = await context.params; return Response.json({ activity: await activityService().detail(farmId, activityId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
