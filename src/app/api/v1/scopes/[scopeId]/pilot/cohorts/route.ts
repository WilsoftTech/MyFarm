import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** Staff only: ADMIN of the organization in the path (D-P09-007). */
export async function GET(_request: Request, context: { params: Promise<{ scopeId: string }> }) {
  try { return Response.json({ cohorts: await fieldPilotService().cohorts((await context.params).scopeId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function POST(request: Request, context: { params: Promise<{ scopeId: string }> }) {
  try { return Response.json({ cohort: await fieldPilotService().createCohort((await context.params).scopeId, await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
