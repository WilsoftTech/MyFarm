import { describe, it, expect, vi } from "vitest";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import type { Account, IdentityRepository, Scope, SessionPort } from "@/modules/engineering-foundation/contracts/identity";
const tenantA = "11111111-1111-4111-8111-111111111111", tenantB = "22222222-2222-4222-8222-222222222222";
const account: Account = { id: "33333333-3333-4333-8333-333333333333", authSubject: "44444444-4444-4444-8444-444444444444", status: "ACTIVE" };
const scope: Scope = { organizationId: tenantA, name: "Own workspace", role: "FARMER", status: "ACTIVE" };
function fixture(overrides: Partial<IdentityRepository> = {}, session: SessionPort = { currentIdentity: async () => ({ authSubject: account.authSubject }) }) {
const repository: IdentityRepository = { accountBySubject: vi.fn(async () => account), scopesForUser: vi.fn(async () => [scope]), scopeForUser: vi.fn(async (_user, id) => id === tenantA ? scope : null), ...overrides };
return { service: new AuthorizationService(session, repository), repository };
}
describe("server authorization", () => {
it("derives actor and role from current server membership", async () => {
const { service } = fixture();
expect(await service.scope(tenantA)).toEqual({ actorId: account.id, organizationId: tenantA, role: "FARMER" });
});
it("denies guessed cross-tenant IDs", async () => { await expect(fixture().service.scope(tenantB)).rejects.toMatchObject({ code: "FORBIDDEN" }); });
it.each(["ADMIN", "AGENT"] as const)("farmer cannot use %s tools", async role => { await expect(fixture().service.scope(tenantA, [role])).rejects.toMatchObject({ code: "FORBIDDEN" }); });
it("administrator has no automatic access to other tenants", async () => { await expect(fixture({ scopeForUser: async () => null }).service.scope(tenantB, ["ADMIN"])).rejects.toMatchObject({ code: "FORBIDDEN" }); });
it("denies revoked memberships", async () => { await expect(fixture({ scopeForUser: async () => ({ ...scope, status: "REVOKED" }) }).service.scope(tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" }); });
it("denies suspended accounts", async () => { await expect(fixture({ accountBySubject: async () => ({ ...account, status: "SUSPENDED" }) }).service.scope(tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" }); });
it("denies missing local account without provisioning one", async () => { await expect(fixture({ accountBySubject: async () => null }).service.overview()).rejects.toMatchObject({ code: "FORBIDDEN" }); });
it("expired/missing verified session cannot call repository", async () => {
const { service, repository } = fixture({}, { currentIdentity: async () => null });
await expect(service.overview()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
expect(repository.accountBySubject).not.toHaveBeenCalled();
});
it("rejects malformed tenant IDs before a query", async () => {
const { service, repository } = fixture();
await expect(service.scope("../other")).rejects.toMatchObject({ code: "INVALID_INPUT" });
expect(repository.scopeForUser).not.toHaveBeenCalled();
});
it("rechecks membership on every request", async () => {
const read = vi.fn().mockResolvedValueOnce(scope).mockResolvedValueOnce({ ...scope, status: "REVOKED" });
const { service } = fixture({ scopeForUser: read });
await service.scope(tenantA);
await expect(service.scope(tenantA)).rejects.toMatchObject({ code: "FORBIDDEN" });
});
});
