import { beforeAll, afterAll, it, expect } from "vitest";
import { config } from "dotenv";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { auditService, unitOfWork } from "@/modules/engineering-foundation/infrastructure/audit";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Integration requires isolated local myfarm_phase01_test database.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 5 }) });
const actor = crypto.randomUUID(), subject = crypto.randomUUID(), tenantA = crypto.randomUUID(), tenantB = crypto.randomUUID();
beforeAll(async () => {
await db.$executeRawUnsafe("CREATE ROLE myfarm_phase01_browser NOLOGIN").catch(() => {});
await db.$executeRawUnsafe('GRANT SELECT ON "User", "Organization", "Membership", "AuditEvent" TO myfarm_phase01_browser');
await db.user.create({ data: { id: actor, authSubject: subject } });
await db.organization.createMany({ data: [{ id: tenantA, name: "Tenant A", kind: "PERSONAL" }, { id: tenantB, name: "Tenant B", kind: "PERSONAL" }] });
await db.membership.create({ data: { userId: actor, organizationId: tenantA, role: "FARMER" } });
});
afterAll(async () => {
await db.auditEvent.deleteMany({ where: { actorId: actor } });
await db.membership.deleteMany({ where: { userId: actor } });
await db.organization.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
await db.user.deleteMany({ where: { id: actor } });
await db.$disconnect();
});
it("connects to real PostgreSQL", async () => { expect(await db.$queryRaw`SELECT 1 AS value`).toEqual([{ value: 1 }]); });
it("scoped repository omits other tenant and denies guessed ID", async () => {
const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(db));
expect((await auth.overview()).scopes.map(s => s.organizationId)).toEqual([tenantA]);
await expect(auth.scope(tenantB)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("revocation takes effect on next request", async () => {
const auth = new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(db));
await auth.scope(tenantA);
await db.membership.update({ where: { userId_organizationId: { userId: actor, organizationId: tenantA } }, data: { status: "REVOKED" } });
await expect(auth.scope(tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" });
await db.membership.update({ where: { userId_organizationId: { userId: actor, organizationId: tenantA } }, data: { status: "ACTIVE" } });
});
it("concurrent duplicate membership writes allow one row", async () => {
const attempts = await Promise.allSettled([0, 1].map(() => db.membership.create({ data: { userId: actor, organizationId: tenantB, role: "AGENT" } })));
expect(attempts.filter(r => r.status === "fulfilled")).toHaveLength(1);
expect(await db.membership.count({ where: { userId: actor, organizationId: tenantB } })).toBe(1);
await db.membership.delete({ where: { userId_organizationId: { userId: actor, organizationId: tenantB } } });
});
it("concurrent audit retries append exactly once", async () => {
const input = { actorId: actor, tenantId: tenantA, action: "PRIVATE_FILE_READ" as const, targetId: crypto.randomUUID(), requestId: crypto.randomUUID() };
await Promise.all([auditService(db).append(input), auditService(db).append(input)]);
expect(await db.auditEvent.count({ where: { tenantId: tenantA, requestId: input.requestId } })).toBe(1);
});
it("unit of work rolls audit back when operation fails", async () => {
const requestId = crypto.randomUUID();
await expect(unitOfWork(db).run(async audit => { await audit.append({ actorId: actor, tenantId: tenantA, action: "PRIVATE_FILE_READ", targetId: crypto.randomUUID(), requestId }); throw new Error("forced rollback"); })).rejects.toThrow("forced rollback");
expect(await db.auditEvent.count({ where: { requestId } })).toBe(0);
});
it("foreign keys reject orphan memberships", async () => {
await expect(db.membership.create({ data: { userId: crypto.randomUUID(), organizationId: tenantA, role: "ADMIN" } })).rejects.toThrow();
});
it("RLS is enabled on every application table", async () => {
const rows = await db.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('User', 'Organization', 'Membership', 'AuditEvent') ORDER BY relname`;
expect(rows).toHaveLength(4); expect(rows.every(r => r.relrowsecurity)).toBe(true);
});

it("rejects request ID reuse for a different audit payload", async () => {
const input = { actorId: actor, tenantId: tenantA, action: "PRIVATE_FILE_READ" as const, targetId: crypto.randomUUID(), requestId: crypto.randomUUID() };
await auditService(db).append(input);
await expect(auditService(db).append({ ...input, targetId: crypto.randomUUID() })).rejects.toMatchObject({ code: "CONFLICT" });
expect(await db.auditEvent.count({ where: { requestId: input.requestId } })).toBe(1);
});

it("browser-equivalent DB role cannot read any application rows", async () => {
await db.$transaction(async tx => {
await tx.$executeRawUnsafe("SET LOCAL ROLE myfarm_phase01_browser");
const rows = await tx.$queryRaw<{count: bigint}[]>`SELECT COUNT(*) AS count FROM "Membership"`;
expect(rows[0].count).toBe(0n);
});
});

it("limits distinct private grants atomically while allowing retries and expired windows", async () => {
await db.auditEvent.deleteMany({ where: { actorId: actor } });
await db.auditEvent.createMany({ data: Array.from({ length: 29 }, () => ({ actorId: actor, tenantId: tenantA, action: "PRIVATE_FILE_READ", requestId: crypto.randomUUID() })) });
const inputs = [0, 1].map(() => ({ actorId: actor, tenantId: tenantA, action: "PRIVATE_FILE_READ" as const, targetId: crypto.randomUUID(), requestId: crypto.randomUUID() }));
const attempts = await Promise.allSettled(inputs.map(input => auditService(db).append(input)));
expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
expect(attempts.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "RATE_LIMITED" } });
const accepted = inputs[attempts.findIndex(result => result.status === "fulfilled")];
await expect(auditService(db).append(accepted)).resolves.toBeUndefined();
expect(await db.auditEvent.count({ where: { actorId: actor } })).toBe(30);
await db.auditEvent.updateMany({ where: { actorId: actor }, data: { occurredAt: new Date(Date.now() - 120000) } });
await expect(auditService(db).append({ ...accepted, requestId: crypto.randomUUID() })).resolves.toBeUndefined();
});
