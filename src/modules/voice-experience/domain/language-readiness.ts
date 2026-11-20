import { speechApprovalSchema, type SpeechRegistration } from "../contracts/input";

/** Reviewed gate acceptance supplements measured results; no accuracy threshold is silently invented. */
export function speechIsApproved(registration: Pick<SpeechRegistration, "language" | "provider" | "model" | "approval">): boolean {
  const result = speechApprovalSchema.safeParse(registration.approval);
  if (!result.success) return false;
  const evidence = result.data;
  return evidence.language === registration.language && evidence.provider === registration.provider && evidence.model === registration.model &&
    evidence.measurement.invalidOutputs === 0 && evidence.measurement.correctIntents === evidence.measurement.intentCases;
}

/** Bounded word-level edit distance. Numbers are tokens too; nothing here interprets money. */
export function wordErrors(expected: string, actual: string): { words: number; errors: number } {
  const words = (text: string) => text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (expected.length > 500 || actual.length > 500) throw new Error("Corpus transcript exceeds the contract");
  const reference = words(expected), hypothesis = words(actual);
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let i = 1; i <= reference.length; i++) {
    const current = [i];
    for (let j = 1; j <= hypothesis.length; j++) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1));
    previous = current;
  }
  return { words: reference.length, errors: previous[hypothesis.length] };
}
