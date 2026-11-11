import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ farmId: string; insightId: string }> }) {
  try { const { farmId, insightId } = await context.params; return Response.json({ insight: await farmIntelligenceService().acknowledge(farmId, insightId, await commandBody(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
