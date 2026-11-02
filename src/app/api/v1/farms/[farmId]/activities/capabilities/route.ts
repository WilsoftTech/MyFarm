import { activityService } from "@/modules/farm-activities/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ farmId: string }> }) {
  try { return Response.json({ items: await activityService().capabilities((await context.params).farmId, productionPageInput(request)) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
