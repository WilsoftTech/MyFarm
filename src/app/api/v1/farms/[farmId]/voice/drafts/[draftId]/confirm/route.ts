import { voiceCommandRoute } from "@/modules/voice-experience/infrastructure/http";
export const POST = voiceCommandRoute("receipt", (service, farmId, id, body) => service.confirm(farmId, id, body));
