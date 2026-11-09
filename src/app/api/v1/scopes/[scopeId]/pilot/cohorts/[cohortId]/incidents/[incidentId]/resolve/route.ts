import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ scopeId: string; cohortId: string; incidentId: string }> }) {
  try { const { scopeId, cohortId, incidentId } = await context.params; return Response.json({ incident: await fieldPilotService().resolveIncident(scopeId, cohortId, incidentId, await commandBody(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
