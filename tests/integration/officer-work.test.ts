import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { OfficerAssignmentService } from "@/modules/extension-officers/application/dashboard";
import { OfficerWorkService } from "@/modules/extension-officers/application/work";
import { officerRepository } from "@/modules/extension-officers/infrastructure/repository";
import { officerRegistrationRepository } from "@/modules/extension-officers/infrastructure/registration-repository";
import { officerVisitRepository } from "@/modules/extension-officers/infrastructure/visit-repository";
import { prepareRegistrationSchema } from "@/modules/extension-officers/contracts/work";

describe("Phase 14 farmer-confirmed registration, visits and private media", () => {
  let f: Awaited<ReturnType<typeof inventoryFixture>>, org: string, officerId: string, targetId: string;
  let officer: OfficerWorkService, target: OfficerWorkService, owner: OfficerWorkService, assignments: OfficerAssignmentService;
  let assignmentId: string, visitId: string;
  const acceptedTenants: string[] = [];
  let onPut: () => Promise<void> = async () => undefined;
  const review = { profile: { name: "Consent fixture farmer", phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] }, farm: { name: "Consent fixture farm", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" } };
  beforeAll(async () => {
    f = await inventoryFixture(); org = (await f.owner.organization.create({ data: { name: "Work fixture", kind: "ORGANIZATION" } })).id;
    const officerSubject = crypto.randomUUID(), targetSubject = crypto.randomUUID();
    officerId = (await f.owner.user.create({ data: { authSubject: officerSubject } })).id;
    targetId = (await f.owner.user.create({ data: { authSubject: targetSubject } })).id;
    await f.owner.membership.create({ data: { organizationId: org, userId: officerId, role: "AGENT" } });
    const repo = { ...officerRegistrationRepository(f.runtime), ...officerVisitRepository(f.runtime) };
    const service = (subject: string) => new OfficerWorkService(new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(f.runtime)), repo, async () => ({ put: async () => onPut() }));
    officer = service(officerSubject); target = service(targetSubject); owner = new OfficerWorkService(f.auth, repo, async () => ({ put: async () => onPut() }));
    assignments = new OfficerAssignmentService(f.auth, officerRepository(f.runtime));
    assignmentId = (await assignments.grant(f.scope.farmId, { requestId: crypto.randomUUID(), officerId, permissions: ["DASHBOARD", "VISITS", "FOLLOW_UPS"], confirmed: true })).assignmentId;
  }, 120_000);
  afterAll(async () => {
    if (!f) return;
    await f.owner.officerRegistrationDraft.deleteMany({ where: { organizationId: org } });
    for (const tenantId of [f.scope.tenantId, ...acceptedTenants]) {
      await f.owner.officerVisitPhoto.deleteMany({ where: { tenantId } });
      await f.owner.officerFollowUp.deleteMany({ where: { tenantId } }); await f.owner.officerProblem.deleteMany({ where: { tenantId } });
      await f.owner.officerVisit.deleteMany({ where: { tenantId } }); await f.owner.officerAssignment.deleteMany({ where: { tenantId } });
      if (tenantId !== f.scope.tenantId) {
        await f.owner.farmMember.deleteMany({ where: { tenantId } }); await f.owner.farm.deleteMany({ where: { tenantId } });
        const farmers = await f.owner.farmer.findMany({ where: { tenantId } });
        await f.owner.farmerProfile.deleteMany({ where: { farmerId: { in: farmers.map(row => row.id) } } });
        await f.owner.farmer.deleteMany({ where: { tenantId } }); await f.owner.auditEvent.deleteMany({ where: { tenantId } });
        await f.owner.membership.deleteMany({ where: { organizationId: tenantId } }); await f.owner.organization.delete({ where: { id: tenantId } });
      }
    }
    await f.owner.auditEvent.deleteMany({ where: { tenantId: org } }); await f.owner.membership.deleteMany({ where: { organizationId: org } });
    await f.owner.organization.delete({ where: { id: org } });
    await f.owner.auditEvent.deleteMany({ where: { actorId: { in: [officerId, targetId] } } });
    await f.owner.user.deleteMany({ where: { id: { in: [officerId, targetId] } } }); await f.cleanup();
  });
  const proposal = () => ({ requestId: crypto.randomUUID(), targetUserId: targetId, review });
  it("prepares only a private seven-day draft, with no farmer, farm, membership or grant", async () => {
    const input = proposal(), first = await officer.prepare(org, input);
    expect(await officer.prepare(org, input)).toEqual(first);
    const row = await f.owner.officerRegistrationDraft.findUniqueOrThrow({ where: { id: first.draftId } });
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(7 * 86_400_000);
    expect(await f.owner.farmer.count({ where: { userId: targetId } })).toBe(0);
    expect(await f.owner.membership.count({ where: { userId: targetId } })).toBe(0);
    await expect(owner.draft(first.draftId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(officer.accept(first.draftId, { expectedVersion: 1, payloadHash: row.payloadHash, confirmed: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(officer.prepare(org, { ...input, review: { ...review, farm: { ...review.farm, name: "Changed" } } })).rejects.toMatchObject({ code: "CONFLICT" });
    await target.discard(first.draftId);
    await expect(officer.prepare(org, input)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rejects missing consent, wrong digest and expired draft without creating any records", async () => {
    const input = proposal(), { draftId } = await officer.prepare(org, input), row = await target.draft(draftId);
    for (const command of [{ expectedVersion: 1, payloadHash: row.payloadHash, confirmed: false }, { expectedVersion: 1, payloadHash: "a".repeat(64), confirmed: true }]) await expect(target.accept(draftId, command)).rejects.toBeDefined();
    await target.discard(draftId);
    const normalized = prepareRegistrationSchema.parse(proposal());
    const expired = await f.owner.officerRegistrationDraft.create({ data: { id: normalized.requestId, organizationId: org, officerId, targetUserId: targetId, review: normalized.review, payloadHash: createHash("sha256").update(JSON.stringify(normalized.review)).digest("hex"), createdAt: new Date(Date.now() - 9 * 86_400_000), expiresAt: new Date(Date.now() - 86_400_000) } });
    await expect(target.accept(expired.id, { expectedVersion: 1, payloadHash: expired.payloadHash, confirmed: true })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(target.draft(expired.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await f.owner.officerRegistrationDraft.count({ where: { id: expired.id } })).toBe(0);
    expect(await f.owner.farmer.count({ where: { userId: targetId } })).toBe(0);
  });
  it("current officer eligibility is rechecked before acceptance, and denial rolls back everything", async () => {
    const { draftId } = await officer.prepare(org, proposal()), row = await target.draft(draftId);
    await f.owner.membership.update({ where: { userId_organizationId: { userId: officerId, organizationId: org } }, data: { status: "REVOKED" } });
    try { await expect(target.accept(draftId, { expectedVersion: 1, payloadHash: row.payloadHash, confirmed: true })).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(await f.owner.farmer.count({ where: { userId: targetId } })).toBe(0); }
    finally { await f.owner.membership.update({ where: { userId_organizationId: { userId: officerId, organizationId: org } }, data: { status: "ACTIVE" } }); }
    await officer.discard(draftId);
  });
  it("creates exactly one farmer, farm and named grant through concurrent explicit acceptance and replay", async () => {
    const { draftId } = await officer.prepare(org, proposal()), row = await target.draft(draftId);
    const command = { expectedVersion: row.version, payloadHash: row.payloadHash, confirmed: true };
    const [first, second] = await Promise.all([target.accept(draftId, command), target.accept(draftId, command)]);
    expect(first).toEqual(second);
    const farm = await f.owner.farm.findUniqueOrThrow({ where: { id: first.farmId } }); acceptedTenants.push(farm.tenantId);
    expect(await f.owner.farm.count({ where: { tenantId: farm.tenantId } })).toBe(1);
    expect(await f.owner.officerAssignment.count({ where: { farmId: farm.id, officerId } })).toBe(1);
    expect(await f.owner.farmMember.count({ where: { farmId: farm.id, userId: officerId } })).toBe(0);
    expect((await target.draft(draftId)).review).toBeNull();
    await expect(officer.draft(draftId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(target.discard(draftId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await target.accept(draftId, command)).toEqual(first);
    const extra = await officer.prepare(org, proposal()), extraView = await target.draft(extra.draftId);
    await expect(target.accept(extra.draftId, { expectedVersion: 1, payloadHash: extraView.payloadHash, confirmed: true })).rejects.toMatchObject({ code: "CONFLICT" });
    await target.discard(extra.draftId);
  });
  const visit = () => ({ requestId: crypto.randomUUID(), assignmentId, scheduledOn: "2026-11-21", status: "COMPLETED", observations: "Checked crop condition", recommendation: "Return for follow-up", followUp: { dueOn: "2026-11-22", notes: "Check again" }, problem: "Farmer flagged an issue" });
  it("records a visit and its follow-up and explicit problem atomically and exactly once", async () => {
    const command = visit(), [first, second] = await Promise.all([officer.recordVisit(org, f.scope.farmId, command), officer.recordVisit(org, f.scope.farmId, command)]);
    expect(first).toEqual(second); visitId = first.recordId;
    const rows = await officer.visits(org, f.scope.farmId, assignmentId);
    expect(rows).toHaveLength(1); expect(rows[0].latitude).toBeNull(); expect(rows[0].followUps).toHaveLength(1); expect(rows[0].problems).toHaveLength(1);
    await expect(officer.recordVisit(org, f.scope.farmId, { ...command, observations: "Changed" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(owner.visits(org, f.scope.farmId, assignmentId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(officer.recordVisit(org, crypto.randomUUID(), visit())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("completes work once with version checks and rolls back stale receipts", async () => {
    const [row] = await officer.visits(org, f.scope.farmId, assignmentId), follow = row.followUps[0], problem = row.problems[0];
    const command = { requestId: crypto.randomUUID(), expectedVersion: follow.version };
    const first = await officer.finish(org, f.scope.farmId, "FOLLOW_UP", follow.id, command);
    expect(await officer.finish(org, f.scope.farmId, "FOLLOW_UP", follow.id, command)).toEqual(first);
    const stale = { requestId: crypto.randomUUID(), expectedVersion: 1 };
    await expect(officer.finish(org, f.scope.farmId, "FOLLOW_UP", follow.id, stale)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await f.owner.auditEvent.count({ where: { requestId: stale.requestId } })).toBe(0);
    await officer.finish(org, f.scope.farmId, "PROBLEM", problem.id, { requestId: crypto.randomUUID(), expectedVersion: problem.version });
  });
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  const photo = () => ({ requestId: crypto.randomUUID(), visitId, sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.length, contentType: "image/png" as const });
  it("validates photo bytes before reserve and publishes one metadata record through retry", async () => {
    const command = photo();
    await expect(officer.upload(org, f.scope.farmId, { ...command, sha256: "a".repeat(64) }, bytes)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await f.owner.officerVisitPhoto.count({ where: { id: command.requestId } })).toBe(0);
    expect(await officer.upload(org, f.scope.farmId, command, bytes)).toEqual({ photoId: command.requestId });
    expect(await officer.upload(org, f.scope.farmId, command, bytes)).toEqual({ photoId: command.requestId });
    expect((await owner.readable(null, f.scope.farmId, command.requestId)).role).toBe("FARMER");
    expect((await officer.readable(org, f.scope.farmId, command.requestId)).role).toBe("AGENT");
    await expect(target.readable(null, f.scope.farmId, command.requestId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("bounds each visit to its latest 50 published photos", async () => {
    const common = { tenantId: f.scope.tenantId, farmId: f.scope.farmId, officerId, visitId, contentType: "image/png", byteSize: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), uploadedAt: new Date() };
    const older = crypto.randomUUID();
    await f.owner.officerVisitPhoto.create({ data: { ...common, id: older, createdAt: new Date("2026-01-01T00:00:00Z") } });
    await f.owner.officerVisitPhoto.createMany({ data: Array.from({ length: 51 }, () => ({ ...common, id: crypto.randomUUID() })) });
    const [row] = await officer.visits(org, f.scope.farmId, assignmentId);
    expect(row.photos).toHaveLength(50);
    expect(row.photos.some(item => item.id === older)).toBe(false);
  });
  it("storage policy binds the exact namespaced photo and a live session; peers and flat financial paths are denied", async () => {
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await client.connect();
    const subject = (await f.owner.user.findUniqueOrThrow({ where: { id: officerId } })).authSubject, session = crypto.randomUUID();
    const [published] = await f.owner.officerVisitPhoto.findMany({ where: { farmId: f.scope.farmId, uploadedAt: { not: null } } });
    const pending = photo(); await officerVisitRepository(f.runtime).reservePhoto(officerId, org, f.scope.farmId, pending);
    try {
      await client.query('INSERT INTO auth.users(id) VALUES($1)', [subject]);
      await client.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)', [session, subject]);
      await client.query("BEGIN"); await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)", [subject, JSON.stringify({ sub: subject, session_id: session })]);
      const check = async (key: string, write: boolean) => (await client.query('SELECT myfarm_private.officer_storage_access($1,$2) AS allowed', [key, write])).rows[0].allowed;
      const prefix = `${f.scope.tenantId}/officer-visits/`;
      expect(await check(prefix + published.id, false)).toBe(true);
      expect(await check(prefix + published.id, true)).toBe(false);
      expect(await check(prefix + pending.requestId, true)).toBe(true);
      expect(await check(prefix + pending.requestId, false)).toBe(false);
      expect(await check(`${f.scope.tenantId}/${published.id}`, false)).toBe(false);
      expect(await check(`${crypto.randomUUID()}/officer-visits/${published.id}`, false)).toBe(false);
      expect(await check(prefix + crypto.randomUUID(), false)).toBe(false);
      await client.query("ROLLBACK");
    } finally { await client.query("ROLLBACK"); await client.query('DELETE FROM auth.sessions WHERE id=$1', [session]); await client.query('DELETE FROM auth.users WHERE id=$1', [subject]); await client.end(); }
  });
  it("revocation during upload denies publish and subsequent reads and sync, preserving pending metadata", async () => {
    const command = photo();
    onPut = async () => { await assignments.revoke(f.scope.farmId, { requestId: crypto.randomUUID(), assignmentId, expectedVersion: 1, confirmed: true }); };
    await expect(officer.upload(org, f.scope.farmId, command, bytes)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await f.owner.officerVisitPhoto.findUniqueOrThrow({ where: { id: command.requestId } })).uploadedAt).toBeNull();
    expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
    await expect(officer.visits(org, f.scope.farmId, assignmentId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(officer.recordVisit(org, f.scope.farmId, visit())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
