import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { Role } from "@/modules/engineering-foundation/contracts/identity";
import { parseProductionInput as parse } from "@/modules/enterprises-seasons/application/farm-access";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import { createCohortSchema, joinCohortSchema, paperConsentSchema, promptSchema, resolveIncidentSchema, supportIncidentSchema, withdrawSchema, type CohortSummary, type CohortView, type MyParticipation, type PilotRepository, type StaffScope } from "../contracts/pilot";
import { PILOT_CONSENT_VERSION } from "../domain/consent";
import { pilotMeasures } from "../domain/measures";

export interface PilotAuthorization {
  account(): Promise<{ id: string }>;
  scope(organizationId: unknown, roles?: readonly Role[]): Promise<{ actorId: string; organizationId: string }>;
}
/** Codes are read out loud and typed on phones: no 0/O or 1/I to confuse. */
const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newCohortCode(random: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes)): string {
  return [...random(new Uint8Array(8))].map(byte => CODE_LETTERS[byte % CODE_LETTERS.length]).join("");
}

/**
 * R001 (D-P09-006 to D-P09-009). Farmers act only on their own participation; staff act only as ADMIN of the
 * organization running the cohort, and see measures and pseudonyms, never farm records (D-P09-007).
 */
export class FieldPilotService {
  constructor(private readonly auth: PilotAuthorization, private readonly pilots: PilotRepository, private readonly now: () => Date = () => new Date(), private readonly code: () => string = () => newCohortCode()) {}

  /** A code that is wrong, closed or past its window looks the same, so codes cannot be probed. */
  async join(input: unknown): Promise<MyParticipation> {
    const account = await this.auth.account();
    const command = parse(joinCohortSchema, input);
    const today = farmToday(this.now());
    const cohort = await this.pilots.cohortByCode(command.code);
    if (!cohort || cohort.status !== "ACTIVE" || today > cohort.endOn || cohort.consentVersion !== PILOT_CONSENT_VERSION) throw new FoundationError("FORBIDDEN");
    if (!(await this.pilots.isActiveFarmer(account.id))) throw new FoundationError("FORBIDDEN");
    return this.pilots.join({ userId: account.id, cohort, requestId: command.requestId, enrolledOn: today < cohort.startOn ? cohort.startOn : today });
  }
  async myParticipations(): Promise<MyParticipation[]> {
    return this.pilots.myParticipations((await this.auth.account()).id);
  }
  async withdraw(participationId: unknown, input: unknown): Promise<MyParticipation> {
    const account = await this.auth.account();
    const command = parse(withdrawSchema, { ...(input as object), participationId });
    return this.pilots.withdraw({ userId: account.id, participationId: command.participationId, requestId: command.requestId, expectedVersion: command.expectedVersion });
  }

  private async staff(organizationId: unknown): Promise<StaffScope> {
    const scope = await this.auth.scope(organizationId, ["ADMIN"]);
    return { actorId: scope.actorId, organizationId: scope.organizationId };
  }
  private async ownCohort(scope: StaffScope, cohortId: unknown): Promise<CohortSummary> {
    if (typeof cohortId !== "string" || !/^[0-9a-f-]{36}$/i.test(cohortId)) throw new FoundationError("FORBIDDEN");
    const cohort = await this.pilots.cohort(scope, cohortId);
    if (!cohort) throw new FoundationError("FORBIDDEN");
    return cohort;
  }
  async createCohort(organizationId: unknown, input: unknown): Promise<CohortSummary> {
    const scope = await this.staff(organizationId);
    const command = parse(createCohortSchema, input);
    return this.pilots.createCohort(scope, { ...command, code: this.code(), consentVersion: PILOT_CONSENT_VERSION });
  }
  async cohorts(organizationId: unknown): Promise<CohortSummary[]> {
    return this.pilots.cohorts(await this.staff(organizationId));
  }
  /** Measures are worked out on every request from receipts and logs; nothing is stored. */
  async cohortView(organizationId: unknown, cohortId: unknown): Promise<CohortView> {
    const scope = await this.staff(organizationId);
    const cohort = await this.ownCohort(scope, cohortId);
    const [facts, participants, incidents] = await Promise.all([this.pilots.facts(scope, cohort.cohortId), this.pilots.participants(scope, cohort.cohortId), this.pilots.incidents(scope, cohort.cohortId)]);
    const now = this.now(), today = farmToday(now);
    return { cohort, asOf: now.toISOString(), today, measures: pilotMeasures({ ...facts, today }), participants, incidents };
  }
  async recordPrompt(organizationId: unknown, cohortId: unknown, input: unknown) {
    const scope = await this.staff(organizationId);
    const cohort = await this.ownCohort(scope, cohortId);
    return this.pilots.recordPrompt(scope, cohort.cohortId, parse(promptSchema, input));
  }
  async openIncident(organizationId: unknown, cohortId: unknown, input: unknown) {
    const scope = await this.staff(organizationId);
    const cohort = await this.ownCohort(scope, cohortId);
    return this.pilots.openIncident(scope, cohort.cohortId, parse(supportIncidentSchema, input));
  }
  async resolveIncident(organizationId: unknown, cohortId: unknown, incidentId: unknown, input: unknown) {
    const scope = await this.staff(organizationId);
    const cohort = await this.ownCohort(scope, cohortId);
    const command = parse(resolveIncidentSchema, { ...(input as object), incidentId });
    return this.pilots.resolveIncident(scope, cohort.cohortId, command);
  }
  async recordPaperConsent(organizationId: unknown, cohortId: unknown, participationId: unknown, input: unknown) {
    const scope = await this.staff(organizationId);
    const cohort = await this.ownCohort(scope, cohortId);
    return this.pilots.recordPaperConsent(scope, cohort.cohortId, parse(paperConsentSchema, { ...(input as object), participationId }));
  }
}
