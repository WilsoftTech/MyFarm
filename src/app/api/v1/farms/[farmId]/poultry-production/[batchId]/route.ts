import { poultryProductionService } from "@/modules/harvest-inventory/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export async function GET(_request: Request, context: { params: Promise<{ farmId: string; batchId: string }> }) {
 try { const {farmId,batchId}=await context.params; return Response.json(await poultryProductionService().summary(farmId,batchId), { headers: privateHeaders }); }
 catch (e) { return failureResponse(e, crypto.randomUUID()); }
}
