import "server-only";
import { authorizationService } from "@/modules/engineering-foundation/infrastructure/services";
import { database } from "@/modules/engineering-foundation/infrastructure/database";
import { FieldPilotService } from "../application/pilot";
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
  });
}
