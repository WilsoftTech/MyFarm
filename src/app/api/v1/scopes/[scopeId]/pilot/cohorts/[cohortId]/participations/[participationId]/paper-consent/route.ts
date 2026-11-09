import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ scopeId: string; cohortId: string; participationId: string }> }) {
  try { const { scopeId, cohortId, participationId } = await context.params; return Response.json({ participant: await fieldPilotService().recordPaperConsent(scopeId, cohortId, participationId, await commandBody(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
