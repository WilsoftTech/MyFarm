import { fieldPilotService } from "@/modules/field-pilot/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** A farmer's own pilot participations, and joining with a cohort code (D-P09-006). */
export async function GET() {
  try { return Response.json({ participations: await fieldPilotService().myParticipations() }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function POST(request: Request) {
  try { return Response.json({ participation: await fieldPilotService().join(await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
