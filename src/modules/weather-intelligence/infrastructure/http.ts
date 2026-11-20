import "server-only";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
import { weatherService } from "./services";
type Context = { params: Promise<{ farmId: string }> };
export async function checkRoute(request: Request, context: Context) {
  try { return Response.json(await weatherService().check((await context.params).farmId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function reviewRoute(request: Request, context: Context) {
  try { return Response.json(await weatherService().review((await context.params).farmId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function confirmRoute(request: Request, context: Context) {
  try { return Response.json(await weatherService().confirm((await context.params).farmId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
