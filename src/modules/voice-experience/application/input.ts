import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { authorizeProductionFarm, parseProductionInput as parse, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import { VOICE_LANGUAGES, textIntentRequestSchema, transcriptionSchema, type CaptureConditions, type FallbackReason, type VoiceCapabilities, type VoiceInputAdapters, type VoiceInputResult } from "../contracts/input";
import { feedExpenseIntentSchema, type VoiceIntentAdapter } from "../contracts/voice";
import { speechIsApproved } from "../domain/language-readiness";

export const textFallback = (reason: FallbackReason): VoiceInputResult => ({ kind: "TEXT_FALLBACK", reason });
/** Providers are bounded and may only propose input. This service has no draft/accounting write capability. */
export async function boundedVoiceCall(call: (signal: AbortSignal) => Promise<unknown>, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => call(controller.signal)), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error("Voice adapter unavailable")); }, timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); controller.abort(); }
}
export class VoiceInputService {
  constructor(private readonly authorization: RegistryAuthorization, private readonly farms: ProductionFarmAccess, private readonly adapters: VoiceInputAdapters, private readonly timeoutMs = 1500) {}
  private async authorize(farmId: unknown) { await authorizeProductionFarm(this.authorization, this.farms, farmId); }
  async capabilities(farmId: unknown): Promise<VoiceCapabilities> {
    await this.authorize(farmId);
    return { schemaVersion: 1, retainsAudio: false, languages: VOICE_LANGUAGES.map(language => ({ language, textAvailable: true,
      speechAvailable: this.adapters.speech.some(registration => registration.language === language && speechIsApproved(registration)) })) };
  }
  private async extract(adapter: VoiceIntentAdapter | undefined, text: string): Promise<VoiceInputResult> {
    if (!adapter) return textFallback("LANGUAGE_UNSUPPORTED");
    let result: unknown;
    try { result = await boundedVoiceCall(signal => adapter.extract(text, signal), this.timeoutMs); }
    catch { return textFallback("PROVIDER_UNAVAILABLE"); }
    if (result === null) return textFallback("UNRECOGNIZED");
    const parsed = feedExpenseIntentSchema.safeParse(result);
    return parsed.success ? { kind: "SUGGESTION", intent: parsed.data } : textFallback("INVALID_OUTPUT");
  }
  async suggest(farmId: unknown, input: unknown): Promise<VoiceInputResult> {
    await this.authorize(farmId);
    const request = parse(textIntentRequestSchema, input);
    return this.extract(this.adapters.text.get(request.language), request.text);
  }
  /** Internal adapter contract only: no audio endpoint or browser microphone capture is exposed. */
  async transcribe(farmId: unknown, language: string, audio: Uint8Array, conditions: CaptureConditions): Promise<VoiceInputResult> {
    await this.authorize(farmId);
    if (!conditions.online) return textFallback("OFFLINE");
    if (conditions.microphone === "DENIED") return textFallback("MICROPHONE_DENIED");
    if (conditions.microphone === "UNAVAILABLE") return textFallback("MICROPHONE_UNAVAILABLE");
    if (!conditions.consented) return textFallback("CONSENT_REQUIRED");
    if (!(audio instanceof Uint8Array) || audio.byteLength === 0 || audio.byteLength > 1024 * 1024) throw new FoundationError("INVALID_INPUT");
    const registration = this.adapters.speech.find(item => item.language === language && speechIsApproved(item));
    if (!registration) return textFallback("LANGUAGE_UNSUPPORTED");
    let result: unknown;
    try { result = await boundedVoiceCall(signal => registration.adapter.transcribe(audio, language, signal), this.timeoutMs); }
    catch { return textFallback("PROVIDER_UNAVAILABLE"); }
    const transcript = transcriptionSchema.safeParse(result);
    if (!transcript.success || transcript.data.language !== language) return textFallback("INVALID_OUTPUT");
    return this.extract(this.adapters.text.get(language), transcript.data.transcript);
  }
}
