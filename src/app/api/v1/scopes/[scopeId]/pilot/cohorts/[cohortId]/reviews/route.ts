import { pilotEvidenceService } from "@/modules/field-pilot/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** A go/no-go review: the decision must be one the evidence allows today (D-P09-004). */
export async function POST(request: Request, context: { params: Promise<{ scopeId: string; cohortId: string }> }) {
  try { const { scopeId, cohortId } = await context.params; return Response.json({ review: await pilotEvidenceService().recordReview(scopeId, cohortId, await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
