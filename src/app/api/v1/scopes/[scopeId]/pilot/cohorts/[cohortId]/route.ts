import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** Measures, pseudonyms and incidents for one cohort; never names, money or farm records (D-P09-007). */
export async function GET(_request: Request, context: { params: Promise<{ scopeId: string; cohortId: string }> }) {
  try { const { scopeId, cohortId } = await context.params; return Response.json({ cohort: await fieldPilotService().cohortView(scopeId, cohortId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
