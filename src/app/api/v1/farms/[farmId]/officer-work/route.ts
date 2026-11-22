import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
type Context = { params: Promise<{ farmId: string }> };
export async function GET(request: Request, context: Context) {
  try { const query = new URL(request.url).searchParams; return Response.json(await officerServices().work.visits(query.get("scope"), (await context.params).farmId, query.get("assignmentId")), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function POST(request: Request, context: Context) {
  try { return Response.json(await officerServices().work.recordVisit(new URL(request.url).searchParams.get("scope"), (await context.params).farmId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
