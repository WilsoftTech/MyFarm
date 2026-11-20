import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { feedExpenseIntentSchema, type FeedExpenseIntent, type VoiceIntentAdapter } from "../contracts/voice";
import { transcriptionSchema, type SpeechAdapter, type SpeechMeasurement, type VoiceLanguage } from "../contracts/input";
import { wordErrors } from "../domain/language-readiness";
import { boundedVoiceCall } from "./input";

export interface SpeechCorpusCase { audio: Uint8Array; transcript: string; intent: FeedExpenseIntent | null }
/** A measurement tool, not approval or proof of accuracy beyond the supplied corpus. Audio/text stays in memory. */
export async function evaluateSpeechCorpus(language: VoiceLanguage, speech: SpeechAdapter, intent: VoiceIntentAdapter, cases: readonly SpeechCorpusCase[], timeoutMs = 1500): Promise<SpeechMeasurement> {
  if (!cases.length || cases.length > 30) throw new FoundationError("INVALID_INPUT");
  const measured: SpeechMeasurement = { sampleCount: cases.length, wordCount: 0, wordErrors: 0, intentCases: cases.length, correctIntents: 0, invalidOutputs: 0 };
  for (const sample of cases) {
    const expected = transcriptionSchema.safeParse({ language, transcript: sample.transcript });
    if (!expected.success || !sample.audio.byteLength || sample.audio.byteLength > 1024 * 1024) throw new FoundationError("INVALID_INPUT");
    let transcript = "";
    try {
      const result = transcriptionSchema.parse(await boundedVoiceCall(signal => speech.transcribe(sample.audio, language, signal), timeoutMs));
      if (result.language !== language) throw new Error("Wrong corpus language");
      transcript = result.transcript;
      const resultIntent = await boundedVoiceCall(signal => intent.extract(transcript, signal), timeoutMs);
      const parsed = resultIntent === null ? null : feedExpenseIntentSchema.parse(resultIntent);
      const expectedIntent = sample.intent === null ? null : feedExpenseIntentSchema.parse(sample.intent);
      if (JSON.stringify(parsed) === JSON.stringify(expectedIntent)) measured.correctIntents++;
    } catch { measured.invalidOutputs++; }
    const distance = wordErrors(expected.data.transcript, transcript);
    measured.wordCount += distance.words; measured.wordErrors += distance.errors;
  }
  return measured;
}
