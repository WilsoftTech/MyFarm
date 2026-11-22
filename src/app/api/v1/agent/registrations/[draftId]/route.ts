import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { requireSameOrigin, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
type Context = { params: Promise<{ draftId: string }> };
export async function GET(_request: Request, context: Context) {
  try { return Response.json(await officerServices().work.draft((await context.params).draftId), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function DELETE(request: Request, context: Context) {
  try { requireSameOrigin(request); await officerServices().work.discard((await context.params).draftId); return Response.json({ discarded: true }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
