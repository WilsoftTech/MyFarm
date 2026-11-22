import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
type Context = { params: Promise<{ farmId: string }> };
export async function GET(request: Request, context: Context) {
  try { return Response.json(await officerServices().assignments.list((await context.params).farmId, new URL(request.url).searchParams.get("cursor")), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function POST(request: Request, context: Context) {
  try { return Response.json(await officerServices().assignments.grant((await context.params).farmId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
