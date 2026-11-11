import { farmIntelligenceService } from "@/modules/farm-intelligence/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** Runs the approved rules on the farm's own records and returns the live insights and what could not be judged. */
export async function GET(_request: Request, context: { params: Promise<{ farmId: string }> }) {
  try { return Response.json({ feed: await farmIntelligenceService().feed((await context.params).farmId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
