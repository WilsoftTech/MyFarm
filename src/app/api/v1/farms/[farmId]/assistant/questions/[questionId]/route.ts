import { assistantService } from "@/modules/ai-assistant/infrastructure/services";
import { failureResponse, privateHeaders, requireSameOrigin } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** The asker deletes their own question before its 90 days (D-P11-003). */
export async function DELETE(request: Request, context: { params: Promise<{ farmId: string; questionId: string }> }) {
  try {
    requireSameOrigin(request);
    const { farmId, questionId } = await context.params;
    await assistantService().remove(farmId, questionId);
    return new Response(null, { status: 204, headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
