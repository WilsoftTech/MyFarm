import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { GateCheck, PilotMeasures } from "./measures";

/**
 * Product observation and the recurring-use decision (R002, P0555-P0566, D-P09-004, D-P09-009). Evidence is dated
 * observation of real use: a finding must point at observations, and a decision rests on the server's own gate
 * figures. Downloads and other counts of installs are never an input. Explaining why is left to people.
 */
export const OBSERVATION_KINDS = ["HESITATION", "CONFUSION", "ERROR", "WORKAROUND", "WORDING", "POSITIVE"] as const;
export type ObservationKind = typeof OBSERVATION_KINDS[number];
export const OBSERVED_SCREENS = ["EXPENSE_FORM", "INCOME_FORM", "SALE_OR_PURCHASE_FORM", "HARVEST_FORM", "ACTIVITY_FORM", "STOCK", "OFFLINE_WORK", "FARM_FIGURES", "SIGN_IN", "OTHER"] as const;
export type ObservedScreen = typeof OBSERVED_SCREENS[number];
export const FINDING_STATUSES = ["OPEN", "ACTIONED", "DISMISSED"] as const;
export type FindingStatus = typeof FINDING_STATUSES[number];
export const REVIEW_DECISIONS = ["CONTINUE", "GO", "NO_GO"] as const;
export type ReviewDecision = typeof REVIEW_DECISIONS[number];

export interface Observation { observationId: string; participationId: string | null; observedOn: string; screen: ObservedScreen; kind: ObservationKind; note: string }
export interface Finding { findingId: string; title: string; status: FindingStatus; observationIds: string[] }
export interface ParticipantState { participationId: string; pseudonym: string; status: "ENROLLED" | "WITHDRAWN" }

/** What staff may see of an observation: the farmer by code name only, or nothing once they left. */
export interface ObservationView extends Omit<Observation, "participationId"> { pseudonym: string | null }
export interface FindingView extends Omit<Finding, "observationIds"> { evidence: ObservationView[]; earliest: string | null; latest: string | null }

/**
 * Observations still usable as evidence. A farmer who withdrew is removed entirely, as from the measures
 * (D-P09-009); an observation about no particular farmer stays.
 */
export function currentObservations(observations: readonly Observation[], participants: readonly ParticipantState[]): ObservationView[] {
  const joined = new Map(participants.filter(row => row.status === "ENROLLED").map(row => [row.participationId, row.pseudonym]));
  return observations
    .filter(row => row.participationId === null || joined.has(row.participationId))
    .map(({ participationId, ...rest }) => ({ ...rest, pseudonym: participationId ? joined.get(participationId)! : null }))
    .sort((a, b) => b.observedOn.localeCompare(a.observedOn) || a.observationId.localeCompare(b.observationId));
}

/** Each finding with the observations that still support it, and the dates they span. A finding left with none says so. */
export function findingsWithEvidence(findings: readonly Finding[], observations: readonly ObservationView[]): FindingView[] {
  const byId = new Map(observations.map(row => [row.observationId, row]));
  return findings.map(({ observationIds, ...finding }) => {
    const evidence = observationIds.flatMap(observationId => byId.has(observationId) ? [byId.get(observationId)!] : []).sort((a, b) => a.observedOn.localeCompare(b.observedOn));
    return { ...finding, evidence, earliest: evidence[0]?.observedOn ?? null, latest: evidence.at(-1)?.observedOn ?? null };
  });
}

/** A finding needs at least one observation it can point at; one with none is only an opinion. */
export function assertFindingEvidence(observationIds: readonly string[], usable: readonly ObservationView[]): void {
  const ids = new Set(usable.map(row => row.observationId));
  if (observationIds.length === 0 || new Set(observationIds).size !== observationIds.length || observationIds.some(observationId => !ids.has(observationId))) throw new FoundationError("INVALID_INPUT");
}

/** The gate figures a review records, taken from the server's own measures at the moment of review. */
export interface GateSnapshot { gateWeek: number; retainedVoluntarily: number; onboarded: number; gateMet: boolean; atEnd: boolean }

/**
 * Which decisions the evidence allows (D-P09-004). CONTINUE is always allowed. A decision either way waits until the
 * week-8 check has been judged. GO needs the week-8 check met, and the end check met too once that has been judged.
 */
export function allowedDecisions(gates: PilotMeasures["gates"]): ReviewDecision[] {
  const judged = gates.atWeek8;
  if (!judged) return ["CONTINUE"];
  const goes = judged.met && (gates.atEnd === null || gates.atEnd.met);
  return goes ? ["CONTINUE", "GO", "NO_GO"] : ["CONTINUE", "NO_GO"];
}
export function gateSnapshot(gates: PilotMeasures["gates"]): GateSnapshot | null {
  const check: GateCheck | null = gates.atEnd ?? gates.atWeek8;
  return check ? { gateWeek: check.week, retainedVoluntarily: check.retainedVoluntarily, onboarded: check.onboarded, gateMet: check.met, atEnd: gates.atEnd !== null } : null;
}
export function assertDecision(decision: ReviewDecision, gates: PilotMeasures["gates"]): void {
  if (!allowedDecisions(gates).includes(decision)) throw new FoundationError("CONFLICT");
}
