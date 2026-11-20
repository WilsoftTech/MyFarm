import { describe, expect, it, vi } from "vitest";
import { VoiceDraftService } from "@/modules/voice-experience/application/drafts";
import { executeVoiceDraftSchema, type VoiceDraftRepository } from "@/modules/voice-experience/contracts/drafts";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { requestActionFor } from "@/modules/engineering-foundation/domain/request-limits";

describe("voice draft application boundaries", () => {
  it("authenticates before parsing or looking up a draft", async () => {
    const auth = { account: vi.fn().mockRejectedValue(new FoundationError("UNAUTHENTICATED")), scope: vi.fn() };
    const farms = { farmScopeForMember: vi.fn() };
    const repository: VoiceDraftRepository = { create: vi.fn(), read: vi.fn(), outcome: vi.fn(), edit: vi.fn(), confirm: vi.fn() };
    const service = new VoiceDraftService(auth, farms, repository);
    for (const call of [() => service.create("bad", {}), () => service.read("bad", "bad"), () => service.edit("bad", "bad", {}), () => service.confirm("bad", "bad", {})])
      await expect(call()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(farms.farmScopeForMember).not.toHaveBeenCalled();
    for (const method of Object.values(repository)) expect(method).not.toHaveBeenCalled();
  });
  it("requires explicit agreement bound to a version, exact hash and mutation ID", () => {
    const input = { confirmed: true, version: 1, payloadHash: "a".repeat(64), requestId: crypto.randomUUID() };
    expect(executeVoiceDraftSchema.safeParse(input).success).toBe(true);
    for (const change of [{ confirmed: "yes" }, { confirmed: false }, { version: 0 }, { payloadHash: "abc" }, { requestId: "bad" }, { amount: "1" }])
      expect(executeVoiceDraftSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
  it("uses the existing save limit for each draft write and confirmation route", () => {
    const root = "/api/v1/farms/" + crypto.randomUUID() + "/voice/drafts";
    expect(requestActionFor("POST", root, false)).toBe("SAVE");
    expect(requestActionFor("PATCH", root + "/" + crypto.randomUUID(), false)).toBe("SAVE");
    expect(requestActionFor("POST", root + "/" + crypto.randomUUID() + "/confirm", false)).toBe("SAVE");
  });
});
