import type { VoiceIntentAdapter } from "../contracts/voice";
import { SOURCE_FEED_EXAMPLE, VERBATIM_SOURCE_FEED_EXAMPLE } from "../domain/examples";
export { SOURCE_FEED_EXAMPLE } from "../domain/examples";

/** A single documented fixture, not a speech recognizer or evidence of language accuracy. */
export const fakeVoiceIntentAdapter: VoiceIntentAdapter = {
  async extract(transcript) {
    if (![SOURCE_FEED_EXAMPLE, VERBATIM_SOURCE_FEED_EXAMPLE.toLowerCase()].includes(transcript.trim().toLowerCase())) return null;
    return { kind: "FEED_EXPENSE", totalAmount: "180000", currency: "UGX", bags: 2 };
  },
};
