import type { SpeechAdapter } from "../contracts/input";
import { VERBATIM_SOURCE_FEED_EXAMPLE } from "../domain/examples";

/** Test marker bytes, not an audio recording or evidence of speech/language accuracy. */
export const syntheticSpeechInput = () => new TextEncoder().encode("MyFarm synthetic speech fixture v1");
export const syntheticSpeechAdapter: SpeechAdapter = {
  async transcribe(audio, language, signal) {
    if (signal.aborted) throw new Error("Synthetic speech cancelled");
    const expected = syntheticSpeechInput();
    if (language !== "en" || audio.length !== expected.length || !audio.every((byte, index) => byte === expected[index])) return null;
    return { language, transcript: VERBATIM_SOURCE_FEED_EXAMPLE };
  },
};
