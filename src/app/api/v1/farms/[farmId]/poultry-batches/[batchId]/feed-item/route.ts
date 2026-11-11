import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** D-P10-007: { requestId, itemId, expectedVersion } chooses the supply item this batch is fed from. */
export async function PUT(request: Request, context: { params: Promise<{ farmId: string; batchId: string }> }) {
  try { const { farmId, batchId } = await context.params; return Response.json({ feedItem: await farmIntelligenceService().setFeedItem(farmId, batchId, await commandBody(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
