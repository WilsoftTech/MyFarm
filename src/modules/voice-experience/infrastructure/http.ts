import "server-only";
import { commandBody, failureResponse, privateHeaders } from "@/modules/engineering-foundation/infrastructure/http";
import { voiceDraftService } from "./services";

type Context = { params: Promise<{ farmId: string; draftId?: string }> };
type Service = ReturnType<typeof voiceDraftService>;
export function voiceCommandRoute(key: string, write: (service: Service, farmId: string, draftId: string | undefined, body: unknown) => Promise<unknown>) {
  return async (request: Request, context: Context) => {
    const requestId = crypto.randomUUID();
    try {
      const body = await commandBody(request), { farmId, draftId } = await context.params;
      return Response.json({ [key]: await write(voiceDraftService(), farmId, draftId, body) }, { status: 201, headers: privateHeaders });
    } catch (error) { return failureResponse(error, requestId); }
  };
}
export async function readVoiceDraft(_request: Request, context: Context) {
  const requestId = crypto.randomUUID();
  try {
    const { farmId, draftId } = await context.params;
    return Response.json({ draft: await voiceDraftService().read(farmId, draftId) }, { headers: privateHeaders });
  } catch (error) { return failureResponse(error, requestId); }
}
export async function readVoiceOutcome(_request: Request, context: Context) {
  try {
    const { farmId, draftId } = await context.params;
    return Response.json(await voiceDraftService().outcome(farmId, draftId), { headers: privateHeaders });
  } catch (error) { return failureResponse(error, crypto.randomUUID()); }
}
