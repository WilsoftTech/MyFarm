import { pilotEvidenceService } from "@/modules/field-pilot/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** Observations, findings with the evidence still behind them, reviews, and what the evidence allows (R002). */
export async function GET(_request: Request, context: { params: Promise<{ scopeId: string; cohortId: string }> }) {
  try { const { scopeId, cohortId } = await context.params; return Response.json({ evidence: await pilotEvidenceService().evidenceView(scopeId, cohortId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
