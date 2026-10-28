import { harvestService } from "@/modules/harvest-inventory/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; harvestId: string }> }) {
  try { const { farmId, harvestId } = await context.params; return Response.json({ harvest: await harvestService().detail(farmId, harvestId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
