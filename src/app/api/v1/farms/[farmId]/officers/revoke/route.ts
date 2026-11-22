import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request, context: { params: Promise<{ farmId: string }> }) {
  try { return Response.json(await officerServices().assignments.revoke((await context.params).farmId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
