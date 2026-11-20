import { z } from "zod";
import { PREFERRED_LANGUAGES } from "@/modules/farmer-registry/domain/rules";
import { feedExpenseIntentSchema, type VoiceIntentAdapter } from "./voice";
export const VOICE_LANGUAGES = [...PREFERRED_LANGUAGES, "sw"] as const;
export const voiceLanguageSchema = z.enum(VOICE_LANGUAGES);
export type VoiceLanguage = z.output<typeof voiceLanguageSchema>;
const languageCode = z.string().trim().min(1).max(35).regex(/^[a-zA-Z0-9-]+$/);
export const textIntentRequestSchema = z.object({ language: languageCode, text: z.string().trim().min(1).max(500) }).strict();
export const transcriptionSchema = z.object({ language: languageCode, transcript: z.string().trim().min(1).max(500) }).strict();
export const FALLBACK_REASONS = ["LANGUAGE_UNSUPPORTED", "OFFLINE", "MICROPHONE_DENIED", "MICROPHONE_UNAVAILABLE", "CONSENT_REQUIRED", "PROVIDER_UNAVAILABLE", "INVALID_OUTPUT", "UNRECOGNIZED"] as const;
export type FallbackReason = typeof FALLBACK_REASONS[number];
export const voiceInputResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SUGGESTION"), intent: feedExpenseIntentSchema }).strict(),
  z.object({ kind: z.literal("TEXT_FALLBACK"), reason: z.enum(FALLBACK_REASONS) }).strict(),
]);
export type VoiceInputResult = z.output<typeof voiceInputResultSchema>;
export const speechMeasurementSchema = z.object({
  sampleCount: z.number().int().positive(), wordCount: z.number().int().positive(), wordErrors: z.number().int().nonnegative(),
  intentCases: z.number().int().positive(), correctIntents: z.number().int().nonnegative(), invalidOutputs: z.number().int().nonnegative(),
}).strict().refine(value => value.correctIntents <= value.intentCases && value.intentCases === value.sampleCount);
export type SpeechMeasurement = z.output<typeof speechMeasurementSchema>;
/** Trusted server configuration, never a claim supplied by the speech adapter or a request. */
export const speechApprovalSchema = z.object({
  language: voiceLanguageSchema, provider: z.string().min(1).max(80), model: z.string().min(1).max(100),
  corpusId: z.string().min(1).max(100), corpusSha256: z.string().regex(/^[a-f0-9]{64}$/), evaluatedAt: z.iso.datetime(),
  measurement: speechMeasurementSchema, approvalId: z.string().min(1).max(100), accepted: z.literal(true),
}).strict();
export interface SpeechAdapter {
  /** Ephemeral bytes only. No persistence, account IDs, domain-write handles or confirmation inputs. */
  transcribe(audio: Uint8Array, language: string, signal: AbortSignal): Promise<unknown>;
}
export interface SpeechRegistration { language: VoiceLanguage; provider: string; model: string; adapter: SpeechAdapter; approval: unknown }
export interface VoiceInputAdapters { text: ReadonlyMap<string, VoiceIntentAdapter>; speech: readonly SpeechRegistration[] }
export const voiceCapabilitiesSchema = z.object({
  schemaVersion: z.literal(1), retainsAudio: z.literal(false),
  languages: z.array(z.object({ language: voiceLanguageSchema, speechAvailable: z.boolean(), textAvailable: z.literal(true) }).strict()).max(16),
}).strict();
export type VoiceCapabilities = z.output<typeof voiceCapabilitiesSchema>;
export interface CaptureConditions { online: boolean; microphone: "GRANTED" | "DENIED" | "UNAVAILABLE"; consented: boolean }
