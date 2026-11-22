import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request) {
  try { return Response.json(await officerServices().work.prepare(new URL(request.url).searchParams.get("scope"), await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
