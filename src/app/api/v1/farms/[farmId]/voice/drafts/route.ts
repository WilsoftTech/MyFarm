import { voiceCommandRoute } from "@/modules/voice-experience/infrastructure/http";
export const POST = voiceCommandRoute("draft", (service, farmId, _id, body) => service.create(farmId, body));
