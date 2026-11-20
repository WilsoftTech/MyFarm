import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { VoiceInputService } from "@/modules/voice-experience/application/input";
import { fakeVoiceIntentAdapter, SOURCE_FEED_EXAMPLE } from "@/modules/voice-experience/infrastructure/fake-intent-adapter";
describe("voice input uses current real membership and has no financial persistence capability", () => {
  let mine: Awaited<ReturnType<typeof inventoryFixture>>, other: Awaited<ReturnType<typeof inventoryFixture>>;
  beforeAll(async () => { mine = await inventoryFixture(); other = await inventoryFixture(); }, 120000);
  afterAll(async () => { await mine?.cleanup(); await other?.cleanup(); });
  it("makes suggestions and language fallbacks without writing drafts, financial/stock rows or raw text", async () => {
    const service = new VoiceInputService(mine.auth, registryRepository(mine.runtime), { text: new Map([["en", fakeVoiceIntentAdapter]]), speech: [] });
    const counts = async () => Promise.all([mine.owner.voiceExpenseDraft.count(), mine.owner.accountingRecord.count(), mine.owner.stockMovement.count()]);
    const before = await counts();
    expect(await service.suggest(mine.scope.farmId, { language: "en", text: SOURCE_FEED_EXAMPLE })).toMatchObject({ kind: "SUGGESTION", intent: { totalAmount: "180000" } });
    for (const language of ["lg", "nyn", "sw"]) expect(await service.suggest(mine.scope.farmId, { language, text: SOURCE_FEED_EXAMPLE })).toMatchObject({ kind: "TEXT_FALLBACK" });
    expect(await counts()).toEqual(before);
  });
  it("refuses other farms and revoked membership before invoking providers", async () => {
    const extract = vi.fn(fakeVoiceIntentAdapter.extract);
    const service = new VoiceInputService(mine.auth, registryRepository(mine.runtime), { text: new Map([["en", { extract }]]), speech: [] });
    await expect(service.suggest(other.scope.farmId, { language: "en", text: SOURCE_FEED_EXAMPLE })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await mine.owner.farmMember.update({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: mine.scope.actorId } }, data: { status: "REVOKED" } });
    try {
      await expect(service.suggest(mine.scope.farmId, { language: "en", text: SOURCE_FEED_EXAMPLE })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(service.capabilities(mine.scope.farmId)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(extract).not.toHaveBeenCalled();
    } finally { await mine.owner.farmMember.update({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: mine.scope.actorId } }, data: { status: "ACTIVE" } }); }
  });
});
