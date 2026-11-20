import "server-only";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
import { voiceInputService } from "./services";
type Context = { params: Promise<{ farmId: string }> };
export async function capabilitiesRoute(_request: Request, context: Context) {
  try { return Response.json(await voiceInputService().capabilities((await context.params).farmId), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function suggestRoute(request: Request, context: Context) {
  try {
    const input = await commandBody(request);
    return Response.json(await voiceInputService().suggest((await context.params).farmId, input), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
