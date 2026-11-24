import { cooperativeService } from "@/modules/cooperatives/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function GET() {
  try { return Response.json(await cooperativeService().list(), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
export async function POST(request: Request) {
  try { return Response.json(await cooperativeService().create(await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
