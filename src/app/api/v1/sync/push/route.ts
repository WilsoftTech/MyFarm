import { pushService } from "@/modules/offline-first/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try { return Response.json(await pushService().push(await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
