import { pilotEvidenceService } from "@/modules/field-pilot/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ scopeId: string; cohortId: string; findingId: string }> }) {
  try { const { scopeId, cohortId, findingId } = await context.params; return Response.json({ finding: await pilotEvidenceService().closeFinding(scopeId, cohortId, findingId, await commandBody(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
