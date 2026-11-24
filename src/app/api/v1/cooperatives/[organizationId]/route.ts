import { cooperativeService } from "@/modules/cooperatives/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params, query = new URL(request.url).searchParams;
    return Response.json(await cooperativeService().read(organizationId, query.get("section") ?? "members", query.get("cursor")), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
