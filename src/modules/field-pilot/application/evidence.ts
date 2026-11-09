import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { parseProductionInput as parse } from "@/modules/enterprises-seasons/application/farm-access";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import { closeFindingSchema, findingSchema, observationSchema, reviewSchema, type CohortSummary, type EvidenceRepository, type EvidenceView, type PilotRepository, type ReviewView, type StaffScope } from "../contracts/pilot";
import { allowedDecisions, assertDecision, assertFindingEvidence, currentObservations, findingsWithEvidence, gateSnapshot } from "../domain/evidence";
import { pilotMeasures } from "../domain/measures";
import type { PilotAuthorization } from "./pilot";

/**
 * R002 (P0555-P0566, D-P09-004, D-P09-009): observations, findings and go/no-go reviews, for staff of the running
 * organization only. Evidence is what staff saw and what the server measured; a review's gate figures are worked
 * out here at the moment of review, never taken from the client.
 */
export class PilotEvidenceService {
  constructor(private readonly auth: PilotAuthorization, private readonly pilots: Pick<PilotRepository, "cohort" | "facts">, private readonly evidence: EvidenceRepository, private readonly now: () => Date = () => new Date()) {}

  private async staffCohort(organizationId: unknown, cohortId: unknown): Promise<{ scope: StaffScope; cohort: CohortSummary }> {
    const authorized = await this.auth.scope(organizationId, ["ADMIN"]);
    const scope = { actorId: authorized.actorId, organizationId: authorized.organizationId };
    if (typeof cohortId !== "string" || !/^[0-9a-f-]{36}$/i.test(cohortId)) throw new FoundationError("FORBIDDEN");
    const cohort = await this.pilots.cohort(scope, cohortId);
    if (!cohort) throw new FoundationError("FORBIDDEN");
    return { scope, cohort };
  }
  private async gates(scope: StaffScope, cohortId: string, today: string) {
    return pilotMeasures({ ...(await this.pilots.facts(scope, cohortId)), today });
  }
  private async usable(scope: StaffScope, cohortId: string) {
    const [observations, states] = await Promise.all([this.evidence.observations(scope, cohortId), this.evidence.participantStates(scope, cohortId)]);
    return currentObservations(observations, states);
  }

  async evidenceView(organizationId: unknown, cohortId: unknown): Promise<EvidenceView> {
    const { scope, cohort } = await this.staffCohort(organizationId, cohortId);
    const today = farmToday(this.now());
    const [observations, findings, reviews, measures] = await Promise.all([this.usable(scope, cohort.cohortId), this.evidence.findings(scope, cohort.cohortId), this.evidence.reviews(scope, cohort.cohortId), this.gates(scope, cohort.cohortId, today)]);
    const versions = new Map(findings.map(row => [row.findingId, row.version]));
    return {
      cohort, today, observations, reviews, allowed: allowedDecisions(measures.gates), gate: gateSnapshot(measures.gates),
      findings: findingsWithEvidence(findings, observations).map(row => ({ ...row, version: versions.get(row.findingId) ?? 1 })),
    };
  }
  async recordObservation(organizationId: unknown, cohortId: unknown, input: unknown) {
    const { scope, cohort } = await this.staffCohort(organizationId, cohortId);
    return this.evidence.recordObservation(scope, cohort.cohortId, parse(observationSchema, input));
  }
  /** A finding must point at observations that still stand (D-P09-009). */
  async createFinding(organizationId: unknown, cohortId: unknown, input: unknown) {
    const { scope, cohort } = await this.staffCohort(organizationId, cohortId);
    const command = parse(findingSchema, input);
    assertFindingEvidence(command.observationIds, await this.usable(scope, cohort.cohortId));
    return this.evidence.createFinding(scope, cohort.cohortId, command);
  }
  async closeFinding(organizationId: unknown, cohortId: unknown, findingId: unknown, input: unknown) {
    const { scope, cohort } = await this.staffCohort(organizationId, cohortId);
    return this.evidence.closeFinding(scope, cohort.cohortId, parse(closeFindingSchema, { ...(input as object), findingId }));
  }
  /** The decision must be one the evidence allows today; the gate figures recorded are the server's own. */
  async recordReview(organizationId: unknown, cohortId: unknown, input: unknown): Promise<ReviewView> {
    const { scope, cohort } = await this.staffCohort(organizationId, cohortId);
    const command = parse(reviewSchema, input);
    const today = farmToday(this.now()), measures = await this.gates(scope, cohort.cohortId, today);
    assertDecision(command.decision, measures.gates);
    return this.evidence.recordReview(scope, cohort.cohortId, { ...command, reviewedOn: today, onboarded: measures.onboarded, gate: gateSnapshot(measures.gates) });
  }
}
