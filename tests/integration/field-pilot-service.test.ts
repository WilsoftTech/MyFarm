import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { PushService, type SyncCommandServices } from "@/modules/offline-first/application/sync";
import { receiptLookup } from "@/modules/offline-first/infrastructure/receipts";
import { FieldPilotService } from "@/modules/field-pilot/application/pilot";
import { pilotRepository } from "@/modules/field-pilot/infrastructure/pilot-repository";
import { pilotUsageLog } from "@/modules/field-pilot/infrastructure/usage-log";
import { PILOT_CONSENT_VERSION } from "@/modules/field-pilot/domain/consent";
import { farmToday } from "@/modules/farm-activities/domain/activity";

const id = () => crypto.randomUUID();
const feed = "f4040002-0000-4000-8000-000000000112";
let f: Awaited<ReturnType<typeof inventoryFixture>>;
let staffOrg: string, otherOrg: string, staffSubject: string, otherStaffSubject: string, agentSubject: string, secondSubject: string;
const created: { users: string[]; orgs: string[] } = { users: [], orgs: [] };
const as = (subject: string) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(f.runtime));
const pilot = (subject: string) => new FieldPilotService(as(subject), pilotRepository(f.runtime), () => new Date(), () => "TEST" + id().replace(/[^0-9]/g, "").slice(0, 6).padEnd(6, "7"));
const farmerPilot = () => new FieldPilotService(f.auth, pilotRepository(f.runtime));
const today = farmToday(new Date());
const window = { startOn: new Date(Date.parse(today) - 14 * 86_400_000).toISOString().slice(0, 10), endOn: new Date(Date.parse(today) + 90 * 86_400_000).toISOString().slice(0, 10) };
let code = "", cohortId = "";

async function person(role: "FARMER" | "ADMIN" | "AGENT", organizationId?: string) {
  const subject = id(), user = await f.owner.user.create({ data: { authSubject: subject } });
  created.users.push(user.id);
  const org = organizationId ?? (await f.owner.organization.create({ data: { name: "Personal", kind: "PERSONAL" } })).id;
  if (!organizationId) created.orgs.push(org);
  await f.owner.membership.create({ data: { userId: user.id, organizationId: org, role } });
  return { subject, userId: user.id };
}

beforeAll(async () => {
  f = await inventoryFixture();
  staffOrg = (await f.owner.organization.create({ data: { name: "Pilot team", kind: "ORGANIZATION" } })).id;
  otherOrg = (await f.owner.organization.create({ data: { name: "Another team", kind: "ORGANIZATION" } })).id;
  created.orgs.push(staffOrg, otherOrg);
  staffSubject = (await person("ADMIN", staffOrg)).subject;
  agentSubject = (await person("AGENT", staffOrg)).subject;
  otherStaffSubject = (await person("ADMIN", otherOrg)).subject;
  secondSubject = (await person("FARMER")).subject;
}, 60_000);
afterAll(async () => {
  try {
    for (const table of ["SupportIncident", "PilotPrompt", "PilotParticipation", "PilotCohort"]) await f.owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = ANY($1::uuid[])', [staffOrg, otherOrg]);
    await f.owner.$executeRawUnsafe('DELETE FROM "PilotUsageEvent" WHERE "tenantId" = $1::uuid', f.scope.tenantId);
    await f.owner.$executeRawUnsafe('DELETE FROM "AuditEvent" WHERE "tenantId" = ANY($1::uuid[])', [staffOrg, otherOrg, ...created.orgs]);
    await f.owner.membership.deleteMany({ where: { userId: { in: created.users } } });
    await f.owner.$executeRawUnsafe('DELETE FROM "AuditEvent" WHERE "actorId" = ANY($1::uuid[])', created.users);
    await f.owner.user.deleteMany({ where: { id: { in: created.users } } });
    await f.owner.organization.deleteMany({ where: { id: { in: created.orgs } } });
  } finally { await f.cleanup(); }
});

describe("cohorts and joining (P09-T002, D-P09-006)", () => {
  it("staff open a cohort once, however often the request repeats", async () => {
    const command = { requestId: id(), name: "Rukungiri season A", ...window };
    const cohort = await pilot(staffSubject).createCohort(staffOrg, command);
    expect(await pilot(staffSubject).createCohort(staffOrg, command)).toEqual(cohort);
    expect(cohort).toMatchObject({ name: "Rukungiri season A", status: "ACTIVE", joined: 0 });
    expect(cohort.code).toMatch(/^[A-Z0-9]{6,12}$/);
    code = cohort.code; cohortId = cohort.cohortId;
  });
  it("only staff of that organization may open or see cohorts", async () => {
    const command = { requestId: id(), name: "Not allowed", ...window };
    await expect(pilot(agentSubject).createCohort(staffOrg, command)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(farmerPilot().createCohort(staffOrg, command)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(pilot(otherStaffSubject).cohortView(otherOrg, cohortId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(pilot(otherStaffSubject).cohortView(staffOrg, cohortId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await pilot(otherStaffSubject).cohorts(otherOrg)).toEqual([]);
  });
  it("a farmer joins with the code as read out, once, under a pseudonym; a second farmer gets the next one", async () => {
    const spoken = code.toLowerCase().slice(0, 4) + "-" + code.slice(4);
    const command = { requestId: id(), code: spoken, consentVersion: PILOT_CONSENT_VERSION, agreed: true };
    const joined = await farmerPilot().join(command);
    expect(joined).toMatchObject({ cohortName: "Rukungiri season A", pseudonym: "P-01", status: "ENROLLED", enrolledOn: today });
    expect(await farmerPilot().join({ ...command, requestId: id() })).toEqual(joined);
    expect(await pilot(secondSubject).join({ ...command, requestId: id() })).toMatchObject({ pseudonym: "P-02" });
    expect(await farmerPilot().myParticipations()).toEqual([joined]);
  });
  it("a wrong code, staff joining as a farmer, or an old consent all look the same and create nothing", async () => {
    const before = await f.owner.pilotParticipation.count({ where: { cohortId } });
    const command = { requestId: id(), code, consentVersion: PILOT_CONSENT_VERSION, agreed: true };
    await expect(farmerPilot().join({ ...command, code: "ZZZZZZZZ" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(pilot(staffSubject).join(command)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(farmerPilot().join({ ...command, consentVersion: "pilot-consent-v0" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await f.owner.pilotParticipation.count({ where: { cohortId } })).toBe(before);
  });
});

describe("MYF-P09-AC001 measures from real receipts and logs", () => {
  const view = () => pilot(staffSubject).cohortView(staffOrg, cohortId);
  it("a saved record counts once, however often it is retried", async () => {
    const accounts = new FarmAccountingService(f.auth, registryRepository(f.runtime), farmAccountingRepository(f.runtime));
    const command = { requestId: id(), categoryId: feed, amount: "15000", currency: "UGX", occurredOn: today };
    await accounts.recordTransaction("EXPENSE", f.scope.farmId, command);
    await accounts.recordTransaction("EXPENSE", f.scope.farmId, command);
    const { measures } = await view();
    expect(measures).toMatchObject({ onboarded: 2, expensesRecorded: 1 });
    const week = measures.weeks.at(-1)!;
    expect(week).toMatchObject({ records: 1, activeFarmers: 1, soFar: true });
  });
  it("entries from a phone are logged once; a refused one counts as a sync failure", async () => {
    const services: SyncCommandServices = {
      recordTransaction: (kind, farmId, input) => new FarmAccountingService(f.auth, registryRepository(f.runtime), farmAccountingRepository(f.runtime)).recordTransaction(kind, farmId, input),
      recordHarvest: (farmId, input) => f.harvest.record(farmId, input),
      scheduleActivity: () => Promise.reject(new Error("unused")), recordActivityDone: () => Promise.reject(new Error("unused")), completeActivity: () => Promise.reject(new Error("unused")), currentActivity: () => Promise.reject(new Error("unused")),
      priorReceiptActions: (farmId, requestId) => receiptLookup(f.auth, registryRepository(f.runtime), f.runtime).priorActions(farmId, requestId),
    };
    const push = new PushService(f.auth, services, pilotUsageLog(f.runtime, registryRepository(f.runtime)));
    const entry = (payload: Record<string, unknown>) => ({ clientMutationId: id(), deviceId: id(), farmId: f.scope.farmId, operation: "RECORD_EXPENSE", payload, baseVersion: null, createdAt: new Date().toISOString() });
    const good = entry({ categoryId: feed, amount: "500", currency: "UGX", occurredOn: today }), bad = entry({ categoryId: feed, amount: "-1", currency: "UGX", occurredOn: today });
    await push.push({ commands: [good, bad] });
    await push.push({ commands: [good] });
    expect(await view()).toMatchObject({ measures: { offlineTransactions: 1, syncFailures: 1, syncFailureShare: { status: "AVAILABLE", value: "50" }, expensesRecorded: 2 } });
  });
  it("a staff prompt makes that week not voluntary, and is logged once", async () => {
    const [p1] = (await view()).participants;
    const command = { requestId: id(), participationId: p1.participationId, promptedOn: today, channel: "CALL" };
    const prompt = await pilot(staffSubject).recordPrompt(staffOrg, cohortId, command);
    expect(await pilot(staffSubject).recordPrompt(staffOrg, cohortId, command)).toEqual(prompt);
    const series = (await view()).measures.participants.find(row => row.pseudonym === "P-01")!;
    expect(series.weeks.at(-1)).toMatchObject({ active: true, prompted: true, voluntary: false });
  });
  it("support incidents open and resolve once; paper consent is recorded by staff", async () => {
    const [p1] = (await view()).participants;
    const opened = await pilot(staffSubject).openIncident(staffOrg, cohortId, { requestId: id(), participationId: p1.participationId, openedOn: today, category: "SYNC", severity: "HIGH", summary: "Entries waited a day to send" });
    expect(opened).toMatchObject({ pseudonym: "P-01", status: "OPEN" });
    const resolve = { requestId: id(), resolvedOn: today, expectedVersion: opened.version };
    const resolved = await pilot(staffSubject).resolveIncident(staffOrg, cohortId, opened.incidentId, resolve);
    expect(await pilot(staffSubject).resolveIncident(staffOrg, cohortId, opened.incidentId, resolve)).toEqual(resolved);
    await expect(pilot(staffSubject).resolveIncident(staffOrg, cohortId, opened.incidentId, { ...resolve, requestId: id() })).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await view()).measures.support).toEqual({ total: 1, open: 0, bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 1 } });
    const consent = await pilot(staffSubject).recordPaperConsent(staffOrg, cohortId, p1.participationId, { requestId: id(), paperConsentRef: "FORM-07", expectedVersion: p1.version });
    expect(consent).toMatchObject({ pseudonym: "P-01", paperConsent: true });
  });
  it("staff see pseudonyms and counts, never names, phone numbers, money amounts or records (D-P09-007)", async () => {
    const text = JSON.stringify(await view());
    const profile = await f.owner.farm.findUniqueOrThrow({ where: { id: f.scope.farmId } });
    for (const secret of [profile.name, "15000", "500", f.scope.farmId, f.scope.actorId, f.scope.tenantId]) expect(text).not.toContain(secret);
  });
});

describe("withdrawal (D-P09-009)", () => {
  it("only the farmer can withdraw, once; afterwards they count nowhere and cannot come back", async () => {
    const [mine] = await farmerPilot().myParticipations();
    await expect(pilot(secondSubject).withdraw(mine.participationId, { requestId: id(), expectedVersion: mine.version, confirmed: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const command = { requestId: id(), expectedVersion: mine.version, confirmed: true };
    const left = await farmerPilot().withdraw(mine.participationId, command);
    expect(left).toMatchObject({ status: "WITHDRAWN" });
    expect(await farmerPilot().withdraw(mine.participationId, command)).toEqual(left);
    const after = await pilot(staffSubject).cohortView(staffOrg, cohortId);
    expect(after.measures).toMatchObject({ onboarded: 1, expensesRecorded: 0, offlineTransactions: 0, syncFailures: 0, support: { total: 0 } });
    expect(after.participants.map(row => row.pseudonym)).toEqual(["P-02"]);
    expect(after.incidents[0].pseudonym).toBeNull();
    await expect(farmerPilot().join({ requestId: id(), code, consentVersion: PILOT_CONSENT_VERSION, agreed: true })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
