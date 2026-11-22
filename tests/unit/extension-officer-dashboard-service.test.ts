import { describe, expect, it, vi } from "vitest";
import { OfficerDashboardService } from "@/modules/extension-officers/application/dashboard";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const organizationId = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
const auth: RegistryAuthorization = {
  account: async () => ({ id: actorId, authSubject: actorId, status: "ACTIVE" }),
  scope: async () => ({ actorId, organizationId, role: "AGENT" }),
};
describe("Officer dashboard application boundary", () => {
  it("uses authenticated actor/scope and a separately paginated cursor", async () => {
    const dashboard = vi.fn();
    await new OfficerDashboardService(auth, { dashboard }).read(organizationId, actorId);
    expect(dashboard).toHaveBeenCalledWith(actorId, organizationId, actorId);
  });
  it("authenticates before validation or reading", async () => {
    const dashboard = vi.fn();
    const denied = { ...auth, scope: async () => { throw new FoundationError("FORBIDDEN"); } };
    await expect(new OfficerDashboardService(denied, { dashboard }).read("guessed", "bad")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(dashboard).not.toHaveBeenCalled();
  });
  it("rejects malformed cursor without a repository query", async () => {
    const dashboard = vi.fn();
    await expect(new OfficerDashboardService(auth, { dashboard }).read(organizationId, "guessed")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(dashboard).not.toHaveBeenCalled();
  });
});
