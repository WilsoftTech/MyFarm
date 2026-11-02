import { recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; seriesId: string }> }) {
  try { const { farmId, seriesId } = await context.params; return Response.json({ series: await recurrenceService().detail(farmId, seriesId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
