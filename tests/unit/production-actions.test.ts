import { beforeEach, expect, it, vi } from "vitest";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const mocks = vi.hoisted(() => ({ createEnterprise: vi.fn(), createSeason: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error("REDIRECT:" + path); }) }));
vi.mock("@/modules/enterprises-seasons/infrastructure/services", () => ({ productionService: () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createEnterpriseAction, createSeasonAction } from "@/app/farms/[farmId]/production-actions";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
beforeEach(() => vi.clearAllMocks());
it("redirects only after a committed enterprise, using server-returned identifiers", async () => {
  mocks.createEnterprise.mockResolvedValueOnce({ farmId: "authorized-farm", enterpriseId: "saved-id" });
  const input = { requestId: crypto.randomUUID(), name: "Maize", type: "CROP" };
  await expect(createEnterpriseAction("requested-farm", input)).rejects.toThrow("REDIRECT:/farms/authorized-farm/enterprises/saved-id?saved=1");
  expect(mocks.createEnterprise).toHaveBeenCalledWith("requested-farm", input);
});
it("preserves permission failures as safe feedback and never redirects", async () => {
  mocks.createSeason.mockRejectedValueOnce(new FoundationError("FORBIDDEN"));
  await expect(createSeasonAction("foreign-farm", {})).resolves.toEqual({ ok: false, message: "You do not have access to this record." });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("sanitizes unexpected failures instead of returning database/provider details", async () => {
  mocks.createEnterprise.mockRejectedValueOnce(new Error("internal-fixture-detail"));
  const result = await createEnterpriseAction("farm", {});
  expect(result).toEqual({ ok: false, message: "MyFarm is unavailable right now. Your details are still here. Try again." });
  expect(mocks.redirect).not.toHaveBeenCalled();
});
it("redirects a committed season and retains the shared registration conflict callback behavior", async () => {
  mocks.createSeason.mockResolvedValueOnce({ farmId: "farm-a", seasonId: "season-a" });
  await expect(createSeasonAction("farm-a", {})).rejects.toThrow("REDIRECT:/farms/farm-a/seasons/season-a?saved=1");
  await expect(runServerCommand(async () => { throw new FoundationError("CONFLICT"); }, () => mocks.redirect("/farmer"))).rejects.toThrow("REDIRECT:/farmer");
});
