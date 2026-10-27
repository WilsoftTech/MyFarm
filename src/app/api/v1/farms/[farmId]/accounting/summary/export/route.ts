import { farmReportService } from "@/modules/farm-accounting/infrastructure/services";
import { productionPageInput } from "@/modules/enterprises-seasons/infrastructure/http";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** CSV of the money summary for active farm members only (D-P04-009); audited by the service. */
export async function GET(request: Request, context: { params: Promise<{ farmId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const { filename, csv } = await farmReportService().exportSummary((await context.params).farmId, productionPageInput(request));
    return new Response(csv, { headers: { ...privateHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"" + filename + "\"", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failureResponse(error, requestId); }
}
