import { cooperativeService } from "@/modules/cooperatives/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try { const { organizationId } = await context.params; return Response.json(await cooperativeService().relationship(organizationId, await commandBody(request)), { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
