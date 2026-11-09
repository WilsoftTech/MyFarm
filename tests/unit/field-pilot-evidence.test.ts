import { describe, expect, it } from "vitest";
import { allowedDecisions, assertDecision, assertFindingEvidence, currentObservations, findingsWithEvidence, gateSnapshot, type Observation, type ParticipantState } from "@/modules/field-pilot/domain/evidence";
import type { GateCheck } from "@/modules/field-pilot/domain/measures";

const id = () => crypto.randomUUID();
const p1: ParticipantState = { participationId: id(), pseudonym: "P-01", status: "ENROLLED" };
const gone: ParticipantState = { participationId: id(), pseudonym: "P-02", status: "WITHDRAWN" };
const seen = (participationId: string | null, observedOn: string, overrides: Partial<Observation> = {}): Observation => ({ observationId: id(), participationId, observedOn, screen: "EXPENSE_FORM", kind: "HESITATION", note: "Stopped at the category list", ...overrides });
const check = (week: number, met: boolean, retained = met ? 2 : 1): GateCheck => ({ week, retainedVoluntarily: retained, onboarded: 4, met });

describe("MYF-P09-AC002 evidence is observation, and a farmer who leaves is removed (D-P09-009)", () => {
  it("keeps observations of farmers still in the pilot and general ones, newest first, by code name only", () => {
    const a = seen(p1.participationId, "2027-03-03"), b = seen(null, "2027-03-10", { kind: "WORDING", note: "'Category' meant nothing; 'What did you spend money on?' was clear" }), c = seen(gone.participationId, "2027-03-05");
    const usable = currentObservations([a, b, c], [p1, gone]);
    expect(usable.map(row => [row.observationId, row.pseudonym])).toEqual([[b.observationId, null], [a.observationId, "P-01"]]);
    expect(JSON.stringify(usable)).not.toContain(p1.participationId);
  });
  it("a finding shows only the evidence that still stands, and the dates it spans", () => {
    const a = seen(p1.participationId, "2027-03-03"), b = seen(p1.participationId, "2027-03-17"), c = seen(gone.participationId, "2027-03-05");
    const usable = currentObservations([a, b, c], [p1, gone]);
    const [finding, orphan] = findingsWithEvidence([
      { findingId: id(), title: "Expense category confuses farmers", status: "OPEN", observationIds: [b.observationId, c.observationId, a.observationId] },
      { findingId: id(), title: "Only a withdrawn farmer's view", status: "OPEN", observationIds: [c.observationId] },
    ], usable);
    expect(finding).toMatchObject({ earliest: "2027-03-03", latest: "2027-03-17" });
    expect(finding.evidence.map(row => row.observationId)).toEqual([a.observationId, b.observationId]);
    expect(orphan).toMatchObject({ evidence: [], earliest: null, latest: null });
  });
  it("a new finding must cite at least one usable observation, each once", () => {
    const a = seen(p1.participationId, "2027-03-03"), c = seen(gone.participationId, "2027-03-05");
    const usable = currentObservations([a, c], [p1, gone]);
    expect(() => assertFindingEvidence([a.observationId], usable)).not.toThrow();
    for (const ids of [[], [a.observationId, a.observationId], [c.observationId], [id()]]) expect(() => assertFindingEvidence(ids, usable)).toThrow();
  });
});

describe("the go/no-go decision (D-P09-004)", () => {
  it("before week 8 is judged, only 'continue' is allowed", () => {
    expect(allowedDecisions({ atWeek8: null, atEnd: null })).toEqual(["CONTINUE"]);
    expect(() => assertDecision("GO", { atWeek8: null, atEnd: null })).toThrow();
    expect(() => assertDecision("NO_GO", { atWeek8: null, atEnd: null })).toThrow();
    expect(gateSnapshot({ atWeek8: null, atEnd: null })).toBeNull();
  });
  it("GO needs the week-8 check met, and the end check met once it is judged", () => {
    expect(allowedDecisions({ atWeek8: check(8, true), atEnd: null })).toEqual(["CONTINUE", "GO", "NO_GO"]);
    expect(allowedDecisions({ atWeek8: check(8, false), atEnd: null })).toEqual(["CONTINUE", "NO_GO"]);
    expect(allowedDecisions({ atWeek8: check(8, true), atEnd: check(16, false) })).toEqual(["CONTINUE", "NO_GO"]);
    expect(() => assertDecision("GO", { atWeek8: check(8, false), atEnd: null })).toThrow();
  });
  it("a review records the latest judged check, as the server worked it out", () => {
    expect(gateSnapshot({ atWeek8: check(8, true), atEnd: null })).toEqual({ gateWeek: 8, retainedVoluntarily: 2, onboarded: 4, gateMet: true, atEnd: false });
    expect(gateSnapshot({ atWeek8: check(8, true), atEnd: check(16, false) })).toEqual({ gateWeek: 16, retainedVoluntarily: 1, onboarded: 4, gateMet: false, atEnd: true });
  });
});
