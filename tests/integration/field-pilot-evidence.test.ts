import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { PilotEvidenceService } from "@/modules/field-pilot/application/evidence";
import { FieldPilotService } from "@/modules/field-pilot/application/pilot";
import { evidenceRepository } from "@/modules/field-pilot/infrastructure/evidence-repository";
import { pilotRepository } from "@/modules/field-pilot/infrastructure/pilot-repository";
import { PILOT_CONSENT_VERSION } from "@/modules/field-pilot/domain/consent";
import { farmToday } from "@/modules/farm-activities/domain/activity";

/** MYF-P09-AC002 on real records: a cohort that started 10 weeks ago, so week 8 has been judged. */
const id = () => crypto.randomUUID();
const today = farmToday(new Date());
const dayAt = (offset: number) => new Date(Date.parse(today) + offset * 86_400_000).toISOString().slice(0, 10);
const startOn = dayAt(-70), endOn = dayAt(40);
let f: Awaited<ReturnType<typeof inventoryFixture>>, org = "", otherOrg = "", staffSubject = "", otherSubject = "", cohortId = "";
const users: string[] = [], orgs: string[] = [];
const farmers: { userId: string; participationId: string; subject: string }[] = [];
const as = (subject: string) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(f.runtime));
const evidence = (subject = staffSubject) => new EvidenceServiceFor(subject);
class EvidenceServiceFor extends PilotEvidenceService { constructor(subject: string) { super(as(subject), pilotRepository(f.runtime), evidenceRepository(f.runtime)); } }

beforeAll(async () => {
  f = await inventoryFixture();
  org = (await f.owner.organization.create({ data: { name: "Evidence team", kind: "ORGANIZATION" } })).id;
  otherOrg = (await f.owner.organization.create({ data: { name: "Other team", kind: "ORGANIZATION" } })).id;
  orgs.push(org, otherOrg);
  for (const [organizationId, role] of [[org, "ADMIN"], [otherOrg, "ADMIN"]] as const) {
    const subject = id(), user = await f.owner.user.create({ data: { authSubject: subject } }); users.push(user.id);
    await f.owner.membership.create({ data: { userId: user.id, organizationId, role } });
    if (organizationId === org) staffSubject = subject; else otherSubject = subject;
  }
  const cohort = await new FieldPilotService(as(staffSubject), pilotRepository(f.runtime)).createCohort(org, { requestId: id(), name: "Evidence cohort", startOn, endOn });
  cohortId = cohort.cohortId;
  // Two farmers who joined on the first day; only the first keeps saving records, unprompted, in weeks 5 to 8.
  for (const [index, subject] of [f.scope.actorId, null].entries()) {
    let userId = subject, authSubject = "";
    if (!userId) {
      authSubject = id(); const user = await f.owner.user.create({ data: { authSubject } }); userId = user.id; users.push(userId);
      const personal = await f.owner.organization.create({ data: { name: "Personal", kind: "PERSONAL" } }); orgs.push(personal.id);
      await f.owner.membership.create({ data: { userId, organizationId: personal.id, role: "FARMER" } });
    }
    const participation = await f.owner.pilotParticipation.create({ data: { cohortId, tenantId: org, userId, pseudonym: "P-0" + (index + 1), consentVersion: PILOT_CONSENT_VERSION, enrolledOn: new Date(startOn + "T00:00:00Z"), requestId: id() } });
    farmers.push({ userId, participationId: participation.id, subject: authSubject });
  }
  for (const week of [5, 6, 7, 8]) {
    await f.owner.auditEvent.create({ data: { actorId: farmers[0].userId, tenantId: f.scope.tenantId, action: "ACCOUNTING_EXPENSE_RECORDED", targetId: id(), requestId: id(), occurredAt: new Date(Date.parse(startOn + "T09:00:00Z") + ((week - 1) * 7 + 2) * 86_400_000) } });
  }
}, 60_000);
afterAll(async () => {
  try {
    for (const table of ["PilotFindingEvidence", "PilotFinding", "PilotObservation", "PilotReview", "PilotParticipation", "PilotCohort"]) await f.owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = ANY($1::uuid[])', orgs);
    await f.owner.$executeRawUnsafe('DELETE FROM "AuditEvent" WHERE "tenantId" = ANY($1::uuid[]) OR "actorId" = ANY($2::uuid[])', orgs, users);
    await f.owner.membership.deleteMany({ where: { userId: { in: users } } });
    await f.owner.user.deleteMany({ where: { id: { in: users } } });
    await f.owner.organization.deleteMany({ where: { id: { in: orgs } } });
  } finally { await f.cleanup(); }
});

describe("MYF-P09-AC002 observations and findings (P09-T005)", () => {
  let general = "", aboutSecond = "";
  it("staff record dated observations once, about a farmer by code name or about no one", async () => {
    const command = { requestId: id(), observedOn: dayAt(-60), screen: "EXPENSE_FORM", kind: "WORDING", note: "'Category' meant nothing; 'What did you spend money on?' was clear" };
    general = (await evidence().recordObservation(org, cohortId, command)).observationId;
    expect((await evidence().recordObservation(org, cohortId, command)).observationId).toBe(general);
    aboutSecond = (await evidence().recordObservation(org, cohortId, { requestId: id(), participationId: farmers[1].participationId, observedOn: dayAt(-50), screen: "OFFLINE_WORK", kind: "HESITATION", note: "Waited before pressing Send now" })).observationId;
    const view = await evidence().evidenceView(org, cohortId);
    expect(view.observations.map(row => [row.observationId, row.pseudonym])).toEqual([[aboutSecond, "P-02"], [general, null]]);
    expect(JSON.stringify(view)).not.toContain(farmers[1].userId);
  });
  it("a finding cites observations that stand; one citing nothing or an unknown note is refused", async () => {
    const finding = await evidence().createFinding(org, cohortId, { requestId: id(), title: "Plain words beat 'category'", observationIds: [general, aboutSecond] });
    await expect(evidence().createFinding(org, cohortId, { requestId: id(), title: "No evidence", observationIds: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(evidence().createFinding(org, cohortId, { requestId: id(), title: "Made up", observationIds: [id()] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const [view] = (await evidence().evidenceView(org, cohortId)).findings;
    expect(view).toMatchObject({ findingId: finding.findingId, status: "OPEN", earliest: dayAt(-60), latest: dayAt(-50) });
    const close = { requestId: id(), status: "ACTIONED", expectedVersion: view.version };
    await evidence().closeFinding(org, cohortId, finding.findingId, close);
    await evidence().closeFinding(org, cohortId, finding.findingId, close);
    await expect(evidence().closeFinding(org, cohortId, finding.findingId, { ...close, requestId: id() })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("MYF-P09-AC002 the go/no-go decision on dated evidence (D-P09-004)", () => {
  it("with 1 of 2 farmers kept using it unprompted at week 8, GO is allowed and records the server's own figures", async () => {
    const view = await evidence().evidenceView(org, cohortId);
    expect(view).toMatchObject({ allowed: ["CONTINUE", "GO", "NO_GO"], gate: { gateWeek: 8, retainedVoluntarily: 1, onboarded: 2, gateMet: true, atEnd: false } });
    const command = { requestId: id(), decision: "GO", reason: "Half kept using MyFarm without a reminder at week 8" };
    const review = await evidence().recordReview(org, cohortId, command);
    expect(review).toMatchObject({ decision: "GO", reviewedOn: today, onboarded: 2, gate: { gateWeek: 8, retainedVoluntarily: 1, gateMet: true } });
    expect(await evidence().recordReview(org, cohortId, command)).toEqual(review);
    await expect(evidence().recordReview(org, cohortId, { ...command, requestId: id(), retainedVoluntarily: 2 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("when the farmer who kept going withdraws, the gate is no longer met: GO is refused, NO_GO and CONTINUE are not, and earlier reviews stand", async () => {
    await new FieldPilotService(f.auth, pilotRepository(f.runtime)).withdraw(farmers[0].participationId, { requestId: id(), expectedVersion: 1, confirmed: true });
    const view = await evidence().evidenceView(org, cohortId);
    expect(view).toMatchObject({ allowed: ["CONTINUE", "NO_GO"], gate: { retainedVoluntarily: 0, onboarded: 1, gateMet: false } });
    await expect(evidence().recordReview(org, cohortId, { requestId: id(), decision: "GO", reason: "Try anyway" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await evidence().recordReview(org, cohortId, { requestId: id(), decision: "NO_GO", reason: "Nobody is continuing unprompted" })).toMatchObject({ decision: "NO_GO", gate: { gateMet: false } });
    expect((await evidence().evidenceView(org, cohortId)).reviews.map(row => row.decision)).toEqual(["NO_GO", "GO"]);
  });
  it("a farmer who leaves takes their observations out of the evidence (D-P09-009)", async () => {
    await new FieldPilotService(as(farmers[1].subject), pilotRepository(f.runtime)).withdraw(farmers[1].participationId, { requestId: id(), expectedVersion: 1, confirmed: true });
    const view = await evidence().evidenceView(org, cohortId);
    expect(view.observations.map(row => row.pseudonym)).toEqual([null]);
    expect(view.findings[0]).toMatchObject({ earliest: dayAt(-60), latest: dayAt(-60) });
    expect(view.findings[0].evidence).toHaveLength(1);
  });
});

describe("evidence access (P09-T005)", () => {
  it("only staff of the running organization can see or add evidence", async () => {
    await expect(evidence(otherSubject).evidenceView(otherOrg, cohortId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(evidence(otherSubject).evidenceView(org, cohortId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const farmer = new PilotEvidenceService(f.auth, pilotRepository(f.runtime), evidenceRepository(f.runtime));
    await expect(farmer.recordObservation(org, cohortId, { requestId: id(), observedOn: today, screen: "OTHER", kind: "POSITIVE", note: "Self-praise" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(evidence().evidenceView(org, id())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
