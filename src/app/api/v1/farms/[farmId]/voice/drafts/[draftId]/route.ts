import { readVoiceDraft, voiceCommandRoute } from "@/modules/voice-experience/infrastructure/http";
export const GET = readVoiceDraft;
export const PATCH = voiceCommandRoute("draft", (service, farmId, id, body) => service.edit(farmId, id, body));
