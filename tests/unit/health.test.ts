import { it, expect, vi } from "vitest";
import { HealthService } from "@/modules/engineering-foundation/application/health";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
function auth(verified = true) {
return new AuthorizationService({ currentIdentity: async () => verified ? { authSubject: "subject" } : null }, {
accountBySubject: async () => ({ id: "actor", authSubject: "subject", status: "ACTIVE" }), scopesForUser: async () => [], scopeForUser: async () => null,
});
}
it("unauthenticated readiness cannot probe DB", async () => {
const probe = { ping: vi.fn(async () => {}) }; await expect(new HealthService(auth(false), probe).readiness()).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); expect(probe.ping).not.toHaveBeenCalled();
});
it("authenticated healthy DB is ready", async () => { expect(await new HealthService(auth(), { ping: async () => {} }).readiness()).toEqual({ status: "ready" }); });
it("DB timeout fails readiness instead of claiming success", async () => { await expect(new HealthService(auth(), { ping: async () => { throw new Error("timeout"); } }).readiness()).rejects.toThrow("timeout"); });
