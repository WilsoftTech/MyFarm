import { assistantService } from "@/modules/ai-assistant/infrastructure/services";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
export const dynamic = "force-dynamic";
/** The asker's own questions on this farm still kept (D-P11-003), newest first. */
export async function GET(_request: Request, context: { params: Promise<{ farmId: string }> }) {
  try { return Response.json({ questions: await assistantService().list((await context.params).farmId) }, { headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
/** Ask a question (MYF-P11-R001); a retry with the same requestId returns the same answer. */
export async function POST(request: Request, context: { params: Promise<{ farmId: string }> }) {
  try { return Response.json({ question: await assistantService().ask((await context.params).farmId, await commandBody(request)) }, { status: 201, headers: privateHeaders }); }
  catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
