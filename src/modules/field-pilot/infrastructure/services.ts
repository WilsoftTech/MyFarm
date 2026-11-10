import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { requestLimits } from "@/modules/engineering-foundation/infrastructure/request-limits";
import { PilotEvidenceService } from "../application/evidence";
import { FieldPilotService } from "../application/pilot";
import { evidenceRepository } from "./evidence-repository";
import { pilotRepository } from "./pilot-repository";

export function fieldPilotService() {
  // Anonymous requests must fail before constructing a database client, so each call builds the repository.
  const db = () => pilotRepository(database());
  return new FieldPilotService(authorizationService(), {
    isActiveFarmer: userId => db().isActiveFarmer(userId),
    createCohort: (scope, input) => db().createCohort(scope, input),
    cohorts: scope => db().cohorts(scope),
    cohort: (scope, cohortId) => db().cohort(scope, cohortId),
    cohortByCode: code => db().cohortByCode(code),
    join: input => db().join(input),
    myParticipations: userId => db().myParticipations(userId),
    withdraw: input => db().withdraw(input),
    facts: (scope, cohortId) => db().facts(scope, cohortId),
    participants: (scope, cohortId) => db().participants(scope, cohortId),
    incidents: (scope, cohortId) => db().incidents(scope, cohortId),
    recordPrompt: (scope, cohortId, input) => db().recordPrompt(scope, cohortId, input),
    openIncident: (scope, cohortId, input) => db().openIncident(scope, cohortId, input),
    resolveIncident: (scope, cohortId, input) => db().resolveIncident(scope, cohortId, input),
    recordPaperConsent: (scope, cohortId, input) => db().recordPaperConsent(scope, cohortId, input),
  }, undefined, undefined, {
    allowed: (subject, action) => requestLimits(database()).allowed(subject, action),
    note: (subject, action, requestKey) => requestLimits(database()).note(subject, action, requestKey),
  });
}

export function pilotEvidenceService() {
  const pilots = () => pilotRepository(database()), evidence = () => evidenceRepository(database());
  return new PilotEvidenceService(authorizationService(), {
    cohort: (scope, cohortId) => pilots().cohort(scope, cohortId),
    facts: (scope, cohortId) => pilots().facts(scope, cohortId),
  }, {
    observations: (scope, cohortId) => evidence().observations(scope, cohortId),
    participantStates: (scope, cohortId) => evidence().participantStates(scope, cohortId),
    findings: (scope, cohortId) => evidence().findings(scope, cohortId),
    reviews: (scope, cohortId) => evidence().reviews(scope, cohortId),
    recordObservation: (scope, cohortId, input) => evidence().recordObservation(scope, cohortId, input),
    createFinding: (scope, cohortId, input) => evidence().createFinding(scope, cohortId, input),
    closeFinding: (scope, cohortId, input) => evidence().closeFinding(scope, cohortId, input),
    recordReview: (scope, cohortId, input) => evidence().recordReview(scope, cohortId, input),
  });
}
