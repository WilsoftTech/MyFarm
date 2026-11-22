import { officerServices } from "@/modules/extension-officers/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(await officerServices().dashboard.read(query.get("scope"), query.get("cursor")), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
