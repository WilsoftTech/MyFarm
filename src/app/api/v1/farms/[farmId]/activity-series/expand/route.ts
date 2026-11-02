import { recurrenceService } from "@/modules/farm-activities/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ farmId: string }> }) {
  // The body is unused, but commandBody applies the same-origin JSON checks to this write.
  try { await commandBody(request); return Response.json(await recurrenceService().expand((await context.params).farmId), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
