import { recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ farmId: string; seriesId: string }> }) {
  try { const { farmId, seriesId } = await context.params; return Response.json({ series: await recurrenceService().change(farmId, seriesId, await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
