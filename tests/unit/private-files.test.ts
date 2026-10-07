import { it, expect, vi } from "vitest";
import { PrivateFileService } from "@/modules/engineering-foundation/application/private-files";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import type { Scope } from "@/modules/engineering-foundation/contracts/identity";
const tenant = "11111111-1111-4111-8111-111111111111", object = "22222222-2222-4222-8222-222222222222", requestId = "33333333-3333-4333-8333-333333333333";
const scope: Scope = { organizationId: tenant, name: "Own", role: "FARMER", status: "ACTIVE" };
function fixture(allowed = true, auditFails = false) {
const authorization = new AuthorizationService({ currentIdentity: async () => ({ authSubject: object }) }, {
accountBySubject: async () => ({ id: requestId, authSubject: object, status: "ACTIVE" }), scopesForUser: async () => [scope], scopeForUser: async () => allowed ? scope : null,
});
const storage = { signedRead: vi.fn(async () => "https://example.test/signed") };
const audit = { append: vi.fn(async () => { if (auditFails) throw new Error("audit unavailable"); }) };
return { service: new PrivateFileService(authorization, storage, audit), storage, audit };
}
it("denied scope cannot generate file URL or audit", async () => {
const f = fixture(false); await expect(f.service.read(tenant, object, requestId)).rejects.toMatchObject({ code: "FORBIDDEN" });
expect(f.storage.signedRead).not.toHaveBeenCalled(); expect(f.audit.append).not.toHaveBeenCalled();
});
it("rejects path traversal", async () => { const f = fixture(); await expect(f.service.read(tenant, "../../secret", requestId)).rejects.toMatchObject({ code: "INVALID_INPUT" }); expect(f.storage.signedRead).not.toHaveBeenCalled(); });
it("requires audit before grant", async () => { const f = fixture(true, true); await expect(f.service.read(tenant, object, requestId)).rejects.toThrow(); expect(f.storage.signedRead).not.toHaveBeenCalled(); });
it("uses server-derived scope and audits exact object", async () => { const f = fixture(); expect(await f.service.read(tenant, object, requestId)).toBe("https://example.test/signed"); expect(f.audit.append).toHaveBeenCalledWith({ actorId: requestId, tenantId: tenant, action: "PRIVATE_FILE_READ", targetId: object, requestId }); });
