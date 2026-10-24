import { beforeEach, expect, it, vi } from "vitest";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const mocks = vi.hoisted(() => ({ createEnterprise: vi.fn(), createSeason: vi.fn(), start: vi.fn(), listEnterprises: vi.fn(), animalTypes: vi.fn(), redirect: vi.fn((path: string): never => { throw new Error("REDIRECT:" + path); }) }));
vi.mock("@/modules/enterprises-seasons/infrastructure/services", () => ({ productionService: () => mocks, cropCycleService: () => mocks, poultryBatchService: () => mocks }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { createEnterpriseAction, createSeasonAction, startCropCycleAction, moreCropChoicesAction, startPoultryBatchAction, morePoultryChoicesAction } from "@/app/farms/[farmId]/production-actions";
import { runServerCommand } from "@/modules/engineering-foundation/infrastructure/server-command";
beforeEach(() => vi.clearAllMocks());
it("uses returned capabilities for selector availability, including unsupported types", async () => {
  mocks.listEnterprises.mockResolvedValue({ items: [
    { enterpriseId: "unavailable", name: "Plans", type: "CROP", workflow: null, status: "ACTIVE" },
    { enterpriseId: "supported", name: "Planting", type: "OTHER", workflow: "CROP_CYCLE", status: "ACTIVE" },
  ], nextCursor: "next" });
  expect(await moreCropChoicesAction("farm-a", "enterprises", "cursor")).toEqual({ ok: true, page: { items: [
    { id: "unavailable", label: "Plans — production records not available yet", disabled: true },
    { id: "supported", label: "Planting", disabled: false },
  ], nextCursor: "next" } });
  const poultry = await morePoultryChoicesAction("farm-a", "enterprises", "cursor");
  expect(poultry).toMatchObject({ ok: true, page: { items: [
    { id: "unavailable", disabled: true, label: "Plans — production records not available yet" },
    { id: "supported", disabled: true, label: "Planting — not a poultry enterprise" },
  ] } });
});
it("pages selector choices through the authorized service and sanitizes failed reloads", async () => {
  mocks.listEnterprises.mockResolvedValueOnce({ items: [{ enterpriseId: "crop", name: "Coffee", type: "CROP", workflow: "CROP_CYCLE", status: "ACTIVE" }, { enterpriseId: "bird", name: "Layers", type: "POULTRY", workflow: "POULTRY_BATCH", status: "ACTIVE" }], nextCursor: null });
  expect(await moreCropChoicesAction("farm-a", "enterprises", "cursor")).toEqual({ ok: true, page: { items: [{ id: "crop", label: "Coffee", disabled: false }, { id: "bird", label: "Layers — not a crop enterprise", disabled: true }], nextCursor: null } });
  expect(mocks.listEnterprises).toHaveBeenCalledWith("farm-a", { cursor: "cursor" });
  mocks.listEnterprises.mockRejectedValueOnce(new Error("private-provider-detail"));
  expect(await moreCropChoicesAction("farm-a", "enterprises", "cursor")).toEqual({ ok: false, message: expect.stringContaining("Your details are still here") });
});
it("pages poultry choices, disabling non-poultry and closed enterprises, and sanitizes failures", async () => {
  mocks.listEnterprises.mockResolvedValueOnce({ items: [{ enterpriseId: "bird", name: "Layers", type: "POULTRY", workflow: "POULTRY_BATCH", status: "ACTIVE" }, { enterpriseId: "crop", name: "Maize", type: "CROP", workflow: "CROP_CYCLE", status: "ACTIVE" }, { enterpriseId: "old", name: "Old flock", type: "POULTRY", workflow: "POULTRY_BATCH", status: "CLOSED" }], nextCursor: null });
  expect(await morePoultryChoicesAction("farm-a", "enterprises", "cursor")).toEqual({ ok: true, page: { items: [{ id: "bird", label: "Layers", disabled: false }, { id: "crop", label: "Maize — not a poultry enterprise", disabled: true }, { id: "old", label: "Old flock — closed", disabled: true }], nextCursor: null } });
  mocks.animalTypes.mockResolvedValueOnce({ items: [{ animalTypeId: "duck", name: "Duck" }], nextCursor: "next" });
  expect(await morePoultryChoicesAction("farm-a", "animal-types", "cursor")).toEqual({ ok: true, page: { items: [{ id: "duck", label: "Duck" }], nextCursor: "next" } });
  expect(mocks.animalTypes).toHaveBeenCalledWith("farm-a", { cursor: "cursor" });
  mocks.animalTypes.mockRejectedValueOnce(new Error("private-provider-detail"));
  const failed = await morePoultryChoicesAction("farm-a", "animal-types", "cursor");
  expect(failed).toEqual({ ok: false, message: expect.stringContaining("Your details are still here") }); expect(JSON.stringify(failed)).not.toContain("private-provider-detail");
});
it("redirects a poultry batch only after commit and explains duplicate-name and count failures", async () => {
  mocks.start.mockResolvedValueOnce({ farmId: "farm-a", batchId: "batch-a" });
  await expect(startPoultryBatchAction("untrusted-farm", {})).rejects.toThrow("REDIRECT:/farms/farm-a/poultry-batches/batch-a?saved=1");
  mocks.start.mockRejectedValueOnce(new FoundationError("CONFLICT"));
  expect(await startPoultryBatchAction("farm-a", {})).toEqual({ ok: false, message: expect.stringContaining("already use this name") });
  mocks.start.mockRejectedValueOnce(new FoundationError("INVALID_INPUT"));
  expect(await startPoultryBatchAction("farm-a", {})).toEqual({ ok: false, message: expect.stringContaining("whole number of birds") });
  mocks.start.mockRejectedValueOnce(new FoundationError("FORBIDDEN"));
  expect(await startPoultryBatchAction("farm-a", {})).toEqual({ ok: false, message: expect.not.stringContaining("already use this name") });
});
it("redirects a crop only after commit and provides safe area guidance on validation failure", async () => {
  mocks.start.mockResolvedValueOnce({ farmId: "farm-a", cycleId: "cycle-a" });
  await expect(startCropCycleAction("untrusted-farm", {})).rejects.toThrow("REDIRECT:/farms/farm-a/crop-cycles/cycle-a?saved=1");
  expect(mocks.start).toHaveBeenCalledWith("untrusted-farm", {});
  mocks.start.mockRejectedValueOnce(new FoundationError("INVALID_INPUT"));
  expect(await startCropCycleAction("farm-a", {})).toEqual({ ok: false, message: expect.stringContaining("record a reason") });
});
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
