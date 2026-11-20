import { describe, expect, it } from "vitest";
import { speechIsApproved, wordErrors } from "@/modules/voice-experience/domain/language-readiness";
import { VOICE_LANGUAGES } from "@/modules/voice-experience/contracts/input";
const measurement = { sampleCount: 4, wordCount: 40, wordErrors: 1, intentCases: 4, correctIntents: 4, invalidOutputs: 0 };
const approval = { language: "en", provider: "synthetic", model: "v1", corpusId: "test-only", corpusSha256: "a".repeat(64), evaluatedAt: "2026-11-20T00:00:00.000Z", measurement, approvalId: "synthetic-gate", accepted: true };
const registration = { language: "en" as const, provider: "synthetic", model: "v1", approval };
describe("language readiness contract (P12 T007)", () => {
  it.each(VOICE_LANGUAGES)("does not advertise %s without reviewed measured evidence", language => {
    expect(speechIsApproved({ ...registration, language, approval: null })).toBe(false);
  });
  it("binds review to language, provider and model, and refuses unsafe or incomplete measurements", () => {
    expect(speechIsApproved(registration)).toBe(true);
    for (const change of [{ language: "lg" as const }, { model: "v2" }, { provider: "other" }]) expect(speechIsApproved({ ...registration, ...change })).toBe(false);
    for (const change of [{ accepted: false }, { approvalId: "" }, { corpusSha256: "bad" }, { measurement: { ...measurement, sampleCount: 0 } }, { measurement: { ...measurement, correctIntents: 3 } }, { measurement: { ...measurement, invalidOutputs: 1 } }])
      expect(speechIsApproved({ ...registration, approval: { ...approval, ...change } })).toBe(false);
  });
  it("counts substitution, insertion and deletion, including a mistaken number", () => {
    expect(wordErrors("paid 180000 for feed", "paid 18000 for feed")).toEqual({ words: 4, errors: 1 });
    expect(wordErrors("paid for feed", "paid yesterday for feed").errors).toBe(1);
    expect(wordErrors("paid for feed", "paid feed").errors).toBe(1);
    expect(wordErrors("PAID  for feed", "paid for feed").errors).toBe(0);
    expect(() => wordErrors("a".repeat(501), "a")).toThrow();
  });
});
