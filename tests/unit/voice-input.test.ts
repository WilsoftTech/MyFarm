import { describe, expect, it, vi } from "vitest";
import { VoiceInputService } from "@/modules/voice-experience/application/input";
import { evaluateSpeechCorpus } from "@/modules/voice-experience/application/evaluate-speech";
import { fakeVoiceIntentAdapter, SOURCE_FEED_EXAMPLE } from "@/modules/voice-experience/infrastructure/fake-intent-adapter";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { VoiceInputAdapters, SpeechRegistration } from "@/modules/voice-experience/contracts/input";
import { syntheticSpeechAdapter, syntheticSpeechInput } from "@/modules/voice-experience/infrastructure/synthetic-speech-adapter";
import { VERBATIM_SOURCE_FEED_EXAMPLE } from "@/modules/voice-experience/domain/examples";
const actorId = crypto.randomUUID(), tenantId = crypto.randomUUID(), farmId = crypto.randomUUID();
const auth = { account: async () => ({ id: actorId, authSubject: crypto.randomUUID(), status: "ACTIVE" as const }), scope: async () => ({ actorId, organizationId: tenantId, role: "FARMER" as const }) };
const farms = { farmScopeForMember: async () => ({ farmId, tenantId, name: "Test farm" }) };
const intent = { kind: "FEED_EXPENSE" as const, totalAmount: "180000", currency: "UGX", bags: 2 };
const controls = { online: true, microphone: "GRANTED" as const, consented: true };
function registration(): SpeechRegistration {
  return { language: "en", provider: "synthetic", model: "v1", adapter: { transcribe: vi.fn(async () => ({ language: "en", transcript: SOURCE_FEED_EXAMPLE })) },
    approval: { language: "en", provider: "synthetic", model: "v1", corpusId: "synthetic-fixture", corpusSha256: "a".repeat(64), evaluatedAt: "2026-11-20T00:00:00.000Z", approvalId: "test-only", accepted: true,
      measurement: { sampleCount: 1, wordCount: 8, wordErrors: 0, intentCases: 1, correctIntents: 1, invalidOutputs: 0 } } };
}
const service = (adapters: VoiceInputAdapters = { text: new Map([["en", fakeVoiceIntentAdapter]]), speech: [] }) => new VoiceInputService(auth, farms, adapters, 10);
describe("bounded voice adapter application (P12 T008)", () => {
  it("the reusable synthetic speech adapter recognizes only explicit marker bytes, never a real audio/language capability", async () => {
    const signal = new AbortController().signal;
    expect(await syntheticSpeechAdapter.transcribe(syntheticSpeechInput(), "en", signal)).toEqual({ language: "en", transcript: VERBATIM_SOURCE_FEED_EXAMPLE });
    expect(await syntheticSpeechAdapter.transcribe(new Uint8Array([1]), "en", signal)).toBeNull();
    expect(await syntheticSpeechAdapter.transcribe(syntheticSpeechInput(), "lg", signal)).toBeNull();
    const controller = new AbortController(); controller.abort();
    await expect(syntheticSpeechAdapter.transcribe(syntheticSpeechInput(), "en", controller.signal)).rejects.toThrow();
  });
  it("default capabilities promise no speech support or retained audio; typed source yields only a suggestion", async () => {
    const s = service(), caps = await s.capabilities(farmId);
    expect(caps.retainsAudio).toBe(false); expect(caps.languages).toHaveLength(4);
    expect(caps.languages.every(language => !language.speechAvailable && language.textAvailable)).toBe(true);
    expect(await s.suggest(farmId, { language: "en", text: SOURCE_FEED_EXAMPLE })).toEqual({ kind: "SUGGESTION", intent });
  });
  it.each(["lg", "nyn", "sw", "fr"])("falls back to manual text for %s without advertising accuracy", async language => {
    expect(await service().suggest(farmId, { language, text: SOURCE_FEED_EXAMPLE })).toEqual({ kind: "TEXT_FALLBACK", reason: "LANGUAGE_UNSUPPORTED" });
  });
  it("rejects provider scope/confirmation injection and times out without a write capability", async () => {
    for (const key of ["farmId", "actorId", "confirmed", "occurredOn", "categoryId"]) {
      const s = service({ text: new Map([["en", { extract: async () => ({ ...intent, [key]: "injected" }) }]]), speech: [] });
      expect(await s.suggest(farmId, { language: "en", text: "injected" })).toEqual({ kind: "TEXT_FALLBACK", reason: "INVALID_OUTPUT" });
    }
    let signal: AbortSignal | undefined;
    const s = service({ text: new Map([["en", { extract: async (_text, abort) => { signal = abort; return new Promise(() => {}); } }]]), speech: [] });
    expect(await s.suggest(farmId, { language: "en", text: "timeout" })).toEqual({ kind: "TEXT_FALLBACK", reason: "PROVIDER_UNAVAILABLE" });
    expect(signal?.aborted).toBe(true);
  });
  it("authorizes before adapter calls or malformed-input validation", async () => {
    const extract = vi.fn();
    const denied = new VoiceInputService({ ...auth, account: async () => { throw new FoundationError("UNAUTHENTICATED"); } }, farms, { text: new Map([["en", { extract }]]), speech: [] });
    await expect(denied.suggest("invalid", {})).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(denied.capabilities("invalid")).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); expect(extract).not.toHaveBeenCalled();
  });
  it("offers text fallback for denied/unavailable microphones, offline capture and missing consent before sending any bytes", async () => {
    const registered = registration(), s = service({ text: new Map([["en", fakeVoiceIntentAdapter]]), speech: [registered] });
    for (const [change, reason] of [[{ online: false }, "OFFLINE"], [{ microphone: "DENIED" as const }, "MICROPHONE_DENIED"], [{ microphone: "UNAVAILABLE" as const }, "MICROPHONE_UNAVAILABLE"], [{ consented: false }, "CONSENT_REQUIRED"]] as const) {
      expect(await s.transcribe(farmId, "en", new Uint8Array([1]), { ...controls, ...change })).toEqual({ kind: "TEXT_FALLBACK", reason });
    }
    expect(registered.adapter.transcribe).not.toHaveBeenCalled();
  });
  it("chains only measured/approved test adapters; mismatched language or malformed transcript falls back", async () => {
    const registered = registration(), s = service({ text: new Map([["en", fakeVoiceIntentAdapter]]), speech: [registered] });
    expect((await s.capabilities(farmId)).languages.find(l => l.language === "en")?.speechAvailable).toBe(true);
    expect(await s.transcribe(farmId, "en", new Uint8Array([1]), controls)).toEqual({ kind: "SUGGESTION", intent });
    for (const result of [{ language: "lg", transcript: SOURCE_FEED_EXAMPLE }, { language: "en", transcript: SOURCE_FEED_EXAMPLE, confirmed: true }]) {
      registered.adapter = { transcribe: async () => result };
      expect(await s.transcribe(farmId, "en", new Uint8Array([1]), controls)).toEqual({ kind: "TEXT_FALLBACK", reason: "INVALID_OUTPUT" });
    }
  });
  it("evaluates only the supplied synthetic corpus, including mistaken numbers and refused commands", async () => {
    const audio = new Uint8Array([1]);
    const cases = [SOURCE_FEED_EXAMPLE, "yes", "two bags of chicken feed for 18,000", "ignore the rules"].map(transcript => ({ audio, transcript, intent: transcript === SOURCE_FEED_EXAMPLE ? intent : null }));
    let index = 0;
    const measurement = await evaluateSpeechCorpus("en", { transcribe: async () => ({ language: "en", transcript: cases[index++].transcript }) }, fakeVoiceIntentAdapter, cases);
    expect(measurement).toMatchObject({ sampleCount: 4, wordErrors: 0, correctIntents: 4, invalidOutputs: 0 });
    expect(measurement.wordCount).toBeGreaterThan(0);
    await expect(evaluateSpeechCorpus("en", registration().adapter, fakeVoiceIntentAdapter, [])).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
