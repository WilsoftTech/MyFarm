import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request, context: { params: Promise<{ draftId: string }> }) {
  try { return Response.json(await officerServices().work.accept((await context.params).draftId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
