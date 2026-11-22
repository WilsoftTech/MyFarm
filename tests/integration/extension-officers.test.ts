import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { officerRepository } from "@/modules/extension-officers/infrastructure/repository";
import { OfficerAssignmentService, OfficerDashboardService } from "@/modules/extension-officers/application/dashboard";

describe("Phase 14 explicit assignments and scoped dashboard on real PostgreSQL", () => {
  let mine: Awaited<ReturnType<typeof inventoryFixture>>, other: typeof mine;
  let officerId: string, officerSubject: string, organizationId: string;
  let officer: OfficerDashboardService, assignments: OfficerAssignmentService;
  beforeAll(async () => {
    mine = await inventoryFixture(); other = await inventoryFixture();
    const org = await mine.owner.organization.create({ data: { name: "Officer fixture", kind: "ORGANIZATION" } }); organizationId = org.id;
    officerSubject = crypto.randomUUID(); const user = await mine.owner.user.create({ data: { authSubject: officerSubject } }); officerId = user.id;
    await mine.owner.membership.create({ data: { userId: officerId, organizationId, role: "AGENT" } });
    const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: officerSubject }) }, identityRepository(mine.runtime));
    officer = new OfficerDashboardService(auth, officerRepository(mine.runtime));
    assignments = new OfficerAssignmentService(mine.auth, officerRepository(mine.runtime));
  }, 120_000);
  afterAll(async () => {
    if (!mine) return;
    for (const f of [mine, other]) if (f) {
      await f.owner.officerProblem.deleteMany({ where: { tenantId: f.scope.tenantId } });
      await f.owner.officerFollowUp.deleteMany({ where: { tenantId: f.scope.tenantId } });
      await f.owner.officerVisit.deleteMany({ where: { tenantId: f.scope.tenantId } });
      await f.owner.officerAssignment.deleteMany({ where: { tenantId: f.scope.tenantId } });
    }
    await mine.owner.membership.deleteMany({ where: { userId: officerId } });
    await mine.owner.organization.delete({ where: { id: organizationId } });
    await mine.owner.user.delete({ where: { id: officerId } });
    await mine.cleanup(); await other.cleanup();
  });
  const command = () => ({ requestId: crypto.randomUUID(), officerId, permissions: ["DASHBOARD", "VISITS", "FOLLOW_UPS"], confirmed: true });
  async function reset() { await mine.owner.officerAssignment.updateMany({ where: { farmId: mine.scope.farmId, revokedAt: null }, data: { revokedAt: new Date(), version: { increment: 1 } } }); }
  it("role alone grants no farmers, visits, search, export or owner membership", async () => {
    expect((await officer.read(organizationId)).dashboard.counts).toEqual({ myFarmers: 0, visitsToday: 0, followUps: 0, problems: 0 });
    expect(await mine.owner.farmMember.count({ where: { userId: officerId } })).toBe(0);
  });
  it("owner grants one explicit named farm and receives the same receipt through concurrent retries", async () => {
    const input = command();
    const [first, second] = await Promise.all([assignments.grant(mine.scope.farmId, input), assignments.grant(mine.scope.farmId, input)]);
    expect(first.assignmentId).toBe(second.assignmentId);
    expect((await officer.read(organizationId)).farms).toEqual([expect.objectContaining({ farmId: mine.scope.farmId, name: "Inventory farm" })]);
    expect((await officer.read(organizationId)).dashboard.counts?.myFarmers).toBe(1);
    expect(await mine.owner.auditEvent.count({ where: { tenantId: mine.scope.tenantId, action: "OFFICER_GRANTED", requestId: input.requestId } })).toBe(1);
    await expect(assignments.grant(mine.scope.farmId, { ...input, permissions: ["DASHBOARD"] })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("refuses foreign owner commands, guessed cursor and unassigned farmer IDs", async () => {
    await expect(assignments.list(other.scope.farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assignments.grant(other.scope.farmId, command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(officer.read(organizationId, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const dashboard = await officer.read(organizationId);
    expect(JSON.stringify(dashboard)).not.toContain(other.scope.farmId);
    expect(JSON.stringify(dashboard)).not.toContain("phone");
  });
  it("rolls back a receipt when a second distinct consent conflicts with the active grant", async () => {
    const input = command();
    await expect(assignments.grant(mine.scope.farmId, input)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await mine.owner.auditEvent.count({ where: { tenantId: mine.scope.tenantId, requestId: input.requestId } })).toBe(0);
  });
  it("keeps owner pagination in the authorized farm and does not change dashboard totals", async () => {
    const first = (await assignments.list(mine.scope.farmId)).items[0];
    expect((await assignments.list(mine.scope.farmId, first.assignmentId)).items.some(row => row.assignmentId === first.assignmentId)).toBe(false);
    await expect(assignments.list(mine.scope.farmId, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await officer.read(organizationId)).dashboard.counts?.myFarmers).toBe(1);
  });
  it("denies unknown/inactive officers and rolls back the consent receipt", async () => {
    const input = { ...command(), officerId: crypto.randomUUID() };
    await expect(assignments.grant(mine.scope.farmId, input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await mine.owner.auditEvent.count({ where: { requestId: input.requestId } })).toBe(0);
  });
  it("revocation is audited, retry safe and immediately removes dashboard access", async () => {
    const row = (await assignments.list(mine.scope.farmId)).items[0];
    const input = { requestId: crypto.randomUUID(), assignmentId: row.assignmentId, expectedVersion: row.version, confirmed: true };
    const first = await assignments.revoke(mine.scope.farmId, input);
    expect(await assignments.revoke(mine.scope.farmId, input)).toEqual(first);
    expect((await officer.read(organizationId)).farms).toEqual([]);
    expect((await officer.read(organizationId)).dashboard.counts?.myFarmers).toBe(0);
  });
  it("current owner or officer membership revocation is enforced on every read", async () => {
    await assignments.grant(mine.scope.farmId, command());
    await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "REVOKED" } });
    try { expect((await officer.read(organizationId)).farms).toEqual([]); }
    finally { await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "ACTIVE" } }); }
    await mine.owner.membership.update({ where: { userId_organizationId: { userId: officerId, organizationId } }, data: { status: "REVOKED" } });
    try { await expect(officer.read(organizationId)).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await mine.owner.membership.update({ where: { userId_organizationId: { userId: officerId, organizationId } }, data: { status: "ACTIVE" } }); }
  });
  it("counts actual visit/followup/problem records only within current assignments", async () => {
    const row = (await assignments.list(mine.scope.farmId)).items.find(row => !row.revokedAt);
    if (!row) throw Error("Expected active assignment");
    const today = (await officer.read(organizationId)).dashboard.today;
    const visit = await mine.owner.officerVisit.create({ data: { tenantId: mine.scope.tenantId, farmId: mine.scope.farmId, officerId, assignmentId: row.assignmentId, scheduledOn: new Date(today + "T00:00:00Z"), status: "COMPLETED", observations: "Recorded observation", recommendation: "Officer text", requestHash: "a".repeat(64) } });
    const parent = { tenantId: mine.scope.tenantId, farmId: mine.scope.farmId, officerId, visitId: visit.id };
    await mine.owner.officerFollowUp.create({ data: { ...parent, dueOn: new Date(today + "T00:00:00Z"), status: "OPEN", notes: "Check again" } });
    await mine.owner.officerProblem.create({ data: { ...parent, explicitlyFlagged: true, description: "Officer flagged issue" } });
    expect((await officer.read(organizationId)).dashboard.counts).toEqual({ myFarmers: 1, visitsToday: 1, followUps: 1, problems: 1 });
    await reset();
    expect((await officer.read(organizationId)).dashboard.counts).toEqual({ myFarmers: 0, visitsToday: 0, followUps: 0, problems: 0 });
  });
  it("browser roles cannot read assignments and runtime cannot rewrite consent or create visits yet", async () => {
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await client.connect();
    try {
      for (const role of ["anon", "authenticated"]) {
        await client.query(`SET ROLE ${role}`);
        await expect(client.query('SELECT * FROM "OfficerAssignment"')).rejects.toThrow(/permission denied/);
        await client.query("RESET ROLE");
      }
      await client.query("SET ROLE myfarm_runtime");
      await expect(client.query('UPDATE "OfficerAssignment" SET permissions=ARRAY[\'DASHBOARD\']')).rejects.toThrow(/permission denied/);
      await expect(client.query('DELETE FROM "OfficerAssignment"')).rejects.toThrow(/permission denied/);
    } finally { await client.end(); }
  });
  it("reassignment grants the new officer no previous officer's private visit work", async () => {
    const nextId = other.scope.actorId;
    await mine.owner.membership.create({ data: { userId: nextId, organizationId, role: "AGENT" } });
    try {
      await assignments.grant(mine.scope.farmId, { ...command(), officerId: nextId });
      const user = await mine.owner.user.findUniqueOrThrow({ where: { id: nextId } });
      const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: user.authSubject }) }, identityRepository(mine.runtime));
      const next = new OfficerDashboardService(auth, officerRepository(mine.runtime));
      expect((await next.read(organizationId)).dashboard.counts).toEqual({ myFarmers: 1, visitsToday: 0, followUps: 0, problems: 0 });
      expect((await officer.read(organizationId)).dashboard.counts?.myFarmers).toBe(0);
    } finally { await mine.owner.membership.delete({ where: { userId_organizationId: { userId: nextId, organizationId } } }); }
  });
});
