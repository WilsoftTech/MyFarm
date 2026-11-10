import { farmExportService } from "@/modules/farm-export/infrastructure/services";
import { failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** Everything on the farm as one ZIP of CSV files (D-P09-013); audited, and limited to 3 a day by the proxy. */
export async function GET(_request: Request, context: { params: Promise<{ farmId: string }> }) {
  try {
    const { filename, bytes } = await farmExportService().export((await context.params).farmId);
    return new Response(bytes as BodyInit, { headers: { ...privateHeaders, "Content-Type": "application/zip", "Content-Disposition": "attachment; filename=\"" + filename + "\"", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
