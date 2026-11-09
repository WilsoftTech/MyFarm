import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";

const id = () => crypto.randomUUID();
const CONSENT = "pilot-consent-v1";

it("the field pilot migration rolls back atomically and only adds tables", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Isolated loopback database required");
  const admin = new Client({ connectionString: url }); await admin.connect();
  const name = "myfarm_pilot_upgrade_" + crypto.randomUUID().replaceAll("-", "");
  const target = new URL(url); target.pathname = "/" + name;
  await admin.query('CREATE DATABASE "' + name + '"');
  const db = new Client({ connectionString: target.toString() }); await db.connect();
  try {
    const release = "202611090001_field_pilot";
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p < release).sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    const tables = async () => (await db.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)).rows[0].n;
    const before = await tables();
    const sql = readFileSync("prisma/migrations/" + release + "/migration.sql", "utf8");
    await expect(db.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await db.query("ROLLBACK");
    expect(await tables()).toBe(before);
    await db.query(sql);
    expect(await tables()).toBe(before + 5);
    const unsecured = (await db.query(`SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE ANY (ARRAY['Pilot%', 'Support%']) AND NOT relrowsecurity`)).rows;
    expect(unsecured).toEqual([]);
  } finally { await db.end(); await admin.query('DROP DATABASE "' + name + '"'); await admin.end(); }
}, 60_000);

describe("field pilot policies under the restricted runtime role (D-P09-006 to D-P09-009)", () => {
  let f: Awaited<ReturnType<typeof inventoryFixture>>, staffOrg: string, staff: string, outsider: string, cohort: string;
  const farmer = () => f.scope.actorId;
  beforeAll(async () => {
    f = await inventoryFixture();
    const org = await f.owner.organization.create({ data: { name: "Pilot team", kind: "ORGANIZATION" } }); staffOrg = org.id;
    staff = (await f.owner.user.create({ data: { authSubject: id() } })).id;
    outsider = (await f.owner.user.create({ data: { authSubject: id() } })).id;
    await f.owner.membership.create({ data: { userId: staff, organizationId: staffOrg, role: "ADMIN" } });
    await f.owner.membership.create({ data: { userId: outsider, organizationId: staffOrg, role: "AGENT" } });
    cohort = (await f.runtime.pilotCohort.create({ data: { tenantId: staffOrg, name: "Rukungiri season A", code: "RUK2027A", consentVersion: CONSENT, startOn: new Date("2027-03-01Z"), endOn: new Date("2027-06-20Z"), requestId: id(), createdBy: staff } })).id;
  }, 60_000);
  afterAll(async () => {
    try {
      for (const table of ["SupportIncident", "PilotPrompt", "PilotParticipation", "PilotCohort"]) await f.owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = $1::uuid', staffOrg);
      await f.owner.$executeRawUnsafe('DELETE FROM "PilotUsageEvent" WHERE "tenantId" = $1::uuid', f.scope.tenantId);
      await f.owner.membership.deleteMany({ where: { organizationId: staffOrg } });
      await f.owner.organization.delete({ where: { id: staffOrg } });
      await f.owner.user.deleteMany({ where: { id: { in: [staff, outsider] } } });
    } finally { await f.cleanup(); }
  });
  const join = (data: Record<string, unknown> = {}) => f.runtime.pilotParticipation.create({ data: { cohortId: cohort, tenantId: staffOrg, userId: farmer(), pseudonym: "P-01", consentVersion: CONSENT, enrolledOn: new Date("2027-03-02Z"), requestId: id(), ...data } });

  it("only an active ADMIN of a real organization may open a cohort", async () => {
    const cohortData = { tenantId: staffOrg, name: "x", consentVersion: CONSENT, startOn: new Date("2027-03-01Z"), endOn: new Date("2027-06-20Z") };
    await expect(f.runtime.pilotCohort.create({ data: { ...cohortData, code: "NOTSTAFF1", requestId: id(), createdBy: outsider } })).rejects.toThrow();
    await expect(f.runtime.pilotCohort.create({ data: { ...cohortData, code: "FARMER01", requestId: id(), createdBy: farmer() } })).rejects.toThrow();
    // A farmer's PERSONAL organization cannot run a cohort, even if someone were its ADMIN.
    await expect(f.runtime.pilotCohort.create({ data: { ...cohortData, tenantId: f.scope.tenantId, code: "PERSONAL1", requestId: id(), createdBy: farmer() } })).rejects.toThrow();
    await expect(f.runtime.pilotCohort.create({ data: { ...cohortData, code: "bad code", requestId: id(), createdBy: staff } })).rejects.toThrow();
  });
  it("a farmer joins only under the cohort's current consent; staff and strangers cannot join as farmers", async () => {
    await expect(join({ consentVersion: "old-consent" })).rejects.toThrow();
    await expect(join({ userId: staff })).rejects.toThrow();
    await expect(join({ status: "WITHDRAWN", withdrawnAt: new Date() })).rejects.toThrow();
    await expect(join({ pseudonym: "Alice" })).rejects.toThrow();
    const joined = await join();
    await expect(join({ pseudonym: "P-02" })).rejects.toThrow();
    // Staff may record the paper consent while the farmer is in the pilot; nobody else may.
    await expect(f.runtime.pilotParticipation.update({ where: { id: joined.id }, data: { paperConsentRef: "FORM-7", paperConsentBy: outsider } })).rejects.toThrow();
    await f.runtime.pilotParticipation.update({ where: { id: joined.id }, data: { paperConsentRef: "FORM-7", paperConsentBy: staff, version: { increment: 1 } } });
  });
  it("prompts and incidents are staff-only logs tied to the cohort", async () => {
    const participation = await f.owner.pilotParticipation.findFirstOrThrow({ where: { cohortId: cohort } });
    const prompt = (createdBy: string) => f.runtime.pilotPrompt.create({ data: { cohortId: cohort, tenantId: staffOrg, participationId: participation.id, promptedOn: new Date("2027-03-10Z"), channel: "CALL", requestId: id(), createdBy } });
    await expect(prompt(outsider)).rejects.toThrow();
    await prompt(staff);
    const incident = await f.runtime.supportIncident.create({ data: { cohortId: cohort, tenantId: staffOrg, participationId: participation.id, openedOn: new Date("2027-03-11Z"), category: "SYNC", severity: "HIGH", summary: "Entries waited a day to send", requestId: id(), createdBy: staff } });
    await expect(f.runtime.supportIncident.create({ data: { cohortId: cohort, tenantId: staffOrg, openedOn: new Date("2027-03-11Z"), category: "OTHER", severity: "LOW", summary: "x", requestId: id(), createdBy: farmer() } })).rejects.toThrow();
    await expect(f.runtime.supportIncident.update({ where: { id: incident.id }, data: { status: "RESOLVED" } })).rejects.toThrow();
    await f.runtime.supportIncident.update({ where: { id: incident.id }, data: { status: "RESOLVED", resolvedOn: new Date("2027-03-12Z") } });
    // Resolving is one-way.
    expect((await f.runtime.supportIncident.updateMany({ where: { id: incident.id }, data: { status: "OPEN", resolvedOn: null } })).count).toBe(0);
  });
  it("withdrawal is one-way: no re-enrolment, no further prompts or paper consent (D-P09-009)", async () => {
    const participation = await f.owner.pilotParticipation.findFirstOrThrow({ where: { cohortId: cohort } });
    await expect(f.runtime.pilotParticipation.update({ where: { id: participation.id }, data: { status: "WITHDRAWN" } })).rejects.toThrow();
    await f.runtime.pilotParticipation.update({ where: { id: participation.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), version: { increment: 1 } } });
    expect((await f.runtime.pilotParticipation.updateMany({ where: { id: participation.id }, data: { status: "ENROLLED", withdrawnAt: null } })).count).toBe(0);
    expect((await f.runtime.pilotParticipation.updateMany({ where: { id: participation.id }, data: { paperConsentRef: "FORM-8", paperConsentBy: staff } })).count).toBe(0);
    await expect(f.runtime.pilotPrompt.create({ data: { cohortId: cohort, tenantId: staffOrg, participationId: participation.id, promptedOn: new Date("2027-03-20Z"), channel: "SMS", requestId: id(), createdBy: staff } })).rejects.toThrow();
  });
  it("the usage log accepts only a member acting in their own tenant, once per entry, and nothing is ever deleted", async () => {
    const entry = { tenantId: f.scope.tenantId, actorId: farmer(), kind: "OFFLINE_COMMITTED" as const, operation: "RECORD_EXPENSE", requestId: id() };
    await f.runtime.pilotUsageEvent.create({ data: entry });
    await expect(f.runtime.pilotUsageEvent.create({ data: entry })).rejects.toThrow();
    await expect(f.runtime.pilotUsageEvent.create({ data: { ...entry, requestId: id(), tenantId: staffOrg } })).rejects.toThrow();
    for (const table of ["PilotUsageEvent", "PilotPrompt", "SupportIncident", "PilotParticipation", "PilotCohort"]) {
      await expect(f.runtime.$executeRawUnsafe('DELETE FROM "' + table + '"')).rejects.toThrow();
    }
  });
});

it("the pilot evidence migration rolls back atomically and only adds tables", async () => {
  const url = process.env.TEST_DATABASE_URL!;
  const admin = new Client({ connectionString: url }); await admin.connect();
  const name = "myfarm_evidence_upgrade_" + crypto.randomUUID().replaceAll("-", "");
  const target = new URL(url); target.pathname = "/" + name;
  await admin.query('CREATE DATABASE "' + name + '"');
  const db = new Client({ connectionString: target.toString() }); await db.connect();
  try {
    const release = "202611100001_pilot_evidence";
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p < release).sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    const tables = async () => (await db.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)).rows[0].n;
    const before = await tables(), sql = readFileSync("prisma/migrations/" + release + "/migration.sql", "utf8");
    await expect(db.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await db.query("ROLLBACK");
    expect(await tables()).toBe(before);
    await db.query(sql);
    expect(await tables()).toBe(before + 4);
  } finally { await db.end(); await admin.query('DROP DATABASE "' + name + '"'); await admin.end(); }
}, 60_000);

describe("pilot evidence policies under the restricted runtime role (D-P09-004)", () => {
  let f: Awaited<ReturnType<typeof inventoryFixture>>, org: string, staff: string, cohort: string, other: string;
  beforeAll(async () => {
    f = await inventoryFixture();
    org = (await f.owner.organization.create({ data: { name: "Evidence team", kind: "ORGANIZATION" } })).id;
    staff = (await f.owner.user.create({ data: { authSubject: id() } })).id;
    await f.owner.membership.create({ data: { userId: staff, organizationId: org, role: "ADMIN" } });
    const window = { tenantId: org, consentVersion: CONSENT, startOn: new Date("2027-03-01Z"), endOn: new Date("2027-06-20Z"), createdBy: staff };
    cohort = (await f.runtime.pilotCohort.create({ data: { ...window, name: "A", code: "EVIDENCE1", requestId: id() } })).id;
    other = (await f.runtime.pilotCohort.create({ data: { ...window, name: "B", code: "EVIDENCE2", requestId: id() } })).id;
  }, 60_000);
  afterAll(async () => {
    try {
      for (const table of ["PilotFindingEvidence", "PilotFinding", "PilotObservation", "PilotReview", "PilotCohort"]) await f.owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "tenantId" = $1::uuid', org);
      await f.owner.membership.deleteMany({ where: { organizationId: org } });
      await f.owner.organization.delete({ where: { id: org } });
      await f.owner.user.delete({ where: { id: staff } });
    } finally { await f.cleanup(); }
  });
  const observe = (cohortId: string, createdBy = staff) => f.runtime.pilotObservation.create({ data: { cohortId, tenantId: org, observedOn: new Date("2027-03-03Z"), screen: "EXPENSE_FORM", kind: "WORDING", note: "Category meant nothing", requestId: id(), createdBy } });
  const review = (data: Record<string, unknown>) => f.runtime.pilotReview.create({ data: { cohortId: cohort, tenantId: org, reviewedOn: new Date("2027-04-30Z"), decision: "CONTINUE", onboarded: 4, reason: "Week 8 judged", requestId: id(), createdBy: staff, ...data } });

  it("only staff observe; a finding cites observations of its own cohort and closes one-way", async () => {
    await expect(observe(cohort, f.scope.actorId)).rejects.toThrow();
    const seen = await observe(cohort), elsewhere = await observe(other);
    const finding = await f.runtime.pilotFinding.create({ data: { cohortId: cohort, tenantId: org, title: "Category confuses", requestId: id(), createdBy: staff } });
    await f.runtime.pilotFindingEvidence.create({ data: { findingId: finding.id, observationId: seen.id, tenantId: org } });
    await expect(f.runtime.pilotFindingEvidence.create({ data: { findingId: finding.id, observationId: elsewhere.id, tenantId: org } })).rejects.toThrow();
    await f.runtime.pilotFinding.update({ where: { id: finding.id }, data: { status: "ACTIONED", version: { increment: 1 } } });
    expect((await f.runtime.pilotFinding.updateMany({ where: { id: finding.id }, data: { status: "OPEN" } })).count).toBe(0);
  });
  it("a review records judged gate figures; GO needs a met gate; nothing is ever deleted or changed", async () => {
    await review({});
    await expect(review({ decision: "GO" })).rejects.toThrow();
    await expect(review({ decision: "GO", gateWeek: 8, retainedVoluntarily: 1, gateMet: false })).rejects.toThrow();
    await expect(review({ decision: "NO_GO", gateWeek: 8, retainedVoluntarily: 9, gateMet: false })).rejects.toThrow();
    const go = await review({ decision: "GO", gateWeek: 8, retainedVoluntarily: 2, gateMet: true });
    await expect(review({ createdBy: f.scope.actorId })).rejects.toThrow();
    await expect(f.runtime.$executeRawUnsafe('UPDATE "PilotReview" SET decision = \'NO_GO\' WHERE id = $1::uuid', go.id)).rejects.toThrow();
    for (const table of ["PilotReview", "PilotFindingEvidence", "PilotFinding", "PilotObservation"]) await expect(f.runtime.$executeRawUnsafe('DELETE FROM "' + table + '"')).rejects.toThrow();
  });
});
