import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** Names this account's local database. It grants nothing: every sync call is authorized on its own. */
export async function GET() {
  try { return Response.json({ accountId: (await authorizationService().account()).id }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
