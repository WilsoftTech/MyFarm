import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { VoiceDraftService } from "@/modules/voice-experience/application/drafts";
import { voiceDraftRepository } from "@/modules/voice-experience/infrastructure/draft-repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { farmExportRepository } from "@/modules/farm-export/infrastructure/export-repository";
import { reviewFeedExpense } from "@/modules/voice-experience/domain/expense-review";
import type { VoiceDraftView } from "@/modules/voice-experience/contracts/drafts";

describe("voice expense drafts with the real restricted runtime role (P12 T002)", () => {
  let mine: Awaited<ReturnType<typeof inventoryFixture>>, other: Awaited<ReturnType<typeof inventoryFixture>>;
  const customCategories: string[] = [];
  let service: VoiceDraftService, otherService: VoiceDraftService, categoryId: string;
  const repo = () => voiceDraftRepository(mine.runtime);
  const input = () => ({ review: reviewFeedExpense({ kind: "FEED_EXPENSE", totalAmount: "180000", currency: "UGX", bags: 2 },
    { requestId: crypto.randomUUID(), categoryId, occurredOn: "2026-11-19" }) });
  const confirmation = (draft: VoiceDraftView) => ({ confirmed: true as const, requestId: draft.review.command.requestId, version: draft.version, payloadHash: draft.payloadHash });
  const create = () => service.create(mine.scope.farmId, input());
  const denied = { code: "FORBIDDEN" }, conflict = { code: "CONFLICT" };
  beforeAll(async () => {
    mine = await inventoryFixture(); other = await inventoryFixture();
    categoryId = (await mine.owner.transactionCategory.findFirstOrThrow({ where: { kind: "COST", active: true } })).id;
    service = new VoiceDraftService(mine.auth, registryRepository(mine.runtime), repo());
    otherService = new VoiceDraftService(other.auth, registryRepository(other.runtime), voiceDraftRepository(other.runtime));
  }, 120_000);
  afterAll(async () => {
    if (mine) {
      await mine.owner.voiceExpenseDraft.deleteMany({ where: { tenantId: mine.scope.tenantId } });
      await mine.owner.transactionCategory.deleteMany({ where: { id: { in: customCategories } } });
    }
    await mine?.cleanup(); await other?.cleanup();
  });

  it("saves the source total without any money/stock write or transcript/audio, and retries draft creation once", async () => {
    const command = input(), before = await mine.owner.accountingRecord.count(), stocks = await mine.owner.stockMovement.count();
    const [a, b] = await Promise.all([service.create(mine.scope.farmId, command), service.create(mine.scope.farmId, command)]);
    expect(b).toEqual(a);
    expect(a.review.command.amount).toBe("180000");
    const saved = await mine.owner.voiceExpenseDraft.findUniqueOrThrow({ where: { id: a.draftId } });
    expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBe(30 * 60_000);
    expect(saved.confirmedAt).toBeNull();
    expect(saved.accountingRecordId).toBeNull();
    expect(JSON.stringify(saved)).not.toMatch(/transcript|audio/);
    expect(await mine.owner.accountingRecord.count()).toBe(before);
    expect(await mine.owner.stockMovement.count()).toBe(stocks);
    expect(await service.read(mine.scope.farmId, a.draftId)).toEqual(a);
  });

  it.each([false, "yes", "maybe", null, 1])("refuses agreement %j without an expense", async confirmed => {
    const draft = await create();
    await expect(service.confirm(mine.scope.farmId, draft.draftId, { ...confirmation(draft), confirmed })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await mine.owner.voiceExpenseDraft.findUniqueOrThrow({ where: { id: draft.draftId } })).confirmedAt).toBeNull();
    expect(await mine.owner.auditEvent.count({ where: { requestId: draft.review.command.requestId, action: "ACCOUNTING_EXPENSE_RECORDED" } })).toBe(0);
  });

  it("concurrent confirmation and lost-response replay make exactly one audited UGX 180000 expense, no stock", async () => {
    const draft = await create(), stocks = await mine.owner.stockMovement.count();
    const results = await Promise.all(Array.from({ length: 5 }, () => service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))));
    expect(results.every(result => JSON.stringify(result) === JSON.stringify(results[0]))).toBe(true);
    const row = await mine.owner.accountingRecord.findUniqueOrThrow({ where: { id: results[0].recordId } });
    expect(row.amount.toString()).toBe("180000"); expect(row.currency).toBe("UGX"); expect(row.kind).toBe("EXPENSE");
    expect(await mine.owner.accountingRecord.count({ where: { id: results[0].recordId } })).toBe(1);
    expect(await mine.owner.stockMovement.count()).toBe(stocks);
    const audits = await mine.owner.auditEvent.findMany({ where: { requestId: draft.review.command.requestId } });
    expect(audits.map(a => a.action).sort()).toEqual(["ACCOUNTING_EXPENSE_RECORDED", "VOICE_EXPENSE_CONFIRMED", "VOICE_EXPENSE_DRAFTED"].sort());
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).resolves.toEqual(results[0]);
    await expect(service.outcome(mine.scope.farmId, draft.draftId)).resolves.toEqual({ status: "COMPLETED", receipt: results[0] });
    await expect(otherService.outcome(other.scope.farmId, draft.draftId)).rejects.toMatchObject(denied);
  });

  it("editing a mistaken amount invalidates the old confirmation, and an identical edit retry is safe", async () => {
    const draft = await create();
    const edit = { version: draft.version, review: { ...draft.review, command: { ...draft.review.command, amount: "90000.01" } } };
    const changed = await service.edit(mine.scope.farmId, draft.draftId, edit);
    expect(changed.version).toBe(2); expect(changed.payloadHash).not.toBe(draft.payloadHash);
    expect(changed.expiresAt).toBe(draft.expiresAt);
    await expect(service.edit(mine.scope.farmId, draft.draftId, edit)).resolves.toEqual(changed);
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(conflict);
    const saved = await service.confirm(mine.scope.farmId, draft.draftId, confirmation(changed));
    expect((await mine.owner.accountingRecord.findUniqueOrThrow({ where: { id: saved.recordId } })).amount.toString()).toBe("90000.01");
    await expect(service.edit(mine.scope.farmId, draft.draftId, { version: 2, review: changed.review })).rejects.toMatchObject(conflict);
  });

  it("rejects changed hash/version/key and extra amount/farm/actor fields on confirmation", async () => {
    const draft = await create();
    for (const change of [{ payloadHash: "0".repeat(64) }, { version: 2 }, { requestId: crypto.randomUUID() }])
      await expect(service.confirm(mine.scope.farmId, draft.draftId, { ...confirmation(draft), ...change })).rejects.toMatchObject(conflict);
    for (const change of [{ amount: "1" }, { farmId: other.scope.farmId }, { actorId: other.scope.actorId }])
      await expect(service.confirm(mine.scope.farmId, draft.draftId, { ...confirmation(draft), ...change })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("refuses a different user, farm, tenant and nested link, including direct repository access", async () => {
    const draft = await create();
    await expect(otherService.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(denied);
    await expect(otherService.read(other.scope.farmId, draft.draftId)).rejects.toMatchObject(denied);
    await expect(repo().confirm({ ...mine.scope, actorId: other.scope.actorId }, draft.draftId, confirmation(draft))).rejects.toMatchObject(denied);
    await expect(repo().confirm(other.scope, draft.draftId, confirmation(draft))).rejects.toMatchObject(denied);
    const bad = input(); bad.review.command.plotId = other.cycle.plotId;
    await expect(service.create(mine.scope.farmId, bad)).rejects.toMatchObject(denied);
    expect(await mine.owner.voiceExpenseDraft.count({ where: { requestId: bad.review.command.requestId } })).toBe(0);
  });

  it("keeps drafts private between two active members of the same farm, and exports only one's own", async () => {
    await mine.owner.membership.create({ data: { userId: other.scope.actorId, organizationId: mine.scope.tenantId, role: "FARMER" } });
    await mine.owner.farmMember.create({ data: { userId: other.scope.actorId, tenantId: mine.scope.tenantId, farmId: mine.scope.farmId, role: "OWNER" } });
    try {
      const draft = await create();
      await expect(otherService.read(mine.scope.farmId, draft.draftId)).rejects.toMatchObject(denied);
      await expect(otherService.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(denied);
      const snapshot = await farmExportRepository(other.runtime).snapshot({ ...mine.scope, actorId: other.scope.actorId }, crypto.randomUUID());
      expect(snapshot.tables.find(t => t.file === "my-voice-expenses.csv")?.rows).toEqual([]);
    } finally {
      await mine.owner.farmMember.delete({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: other.scope.actorId } } });
      await mine.owner.membership.delete({ where: { userId_organizationId: { userId: other.scope.actorId, organizationId: mine.scope.tenantId } } });
    }
  });

  it("normalizes the selected batch's enterprise before review, and rejects a cross-farm batch", async () => {
    const enterprise = await mine.owner.enterprise.create({ data: { tenantId: mine.scope.tenantId, farmId: mine.scope.farmId, name: "Layers", type: "POULTRY", createdBy: mine.scope.actorId } });
    // Reuse the persisted poultry schema defaults and actual required fields from the approved batch contract.
    const animal = await mine.owner.animalTypeCatalog.findFirstOrThrow({ where: { active: true } });
    const batch = await mine.owner.poultryBatch.create({ data: { tenantId: mine.scope.tenantId, farmId: mine.scope.farmId, enterpriseId: enterprise.id, batchLabel: "Voice layers", batchLabelKey: "voice layers",
      animalTypeId: animal.id, animalTypeName: animal.name, startingQuantity: 10, acquisitionDate: new Date("2026-11-01Z"), purpose: "EGGS", createdBy: mine.scope.actorId } });
    const command = input(); command.review.command.batchId = batch.id;
    const draft = await service.create(mine.scope.farmId, command);
    expect(draft.review.command.enterpriseId).toBe(enterprise.id);
    const saved = await service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft));
    expect((await mine.owner.accountingRecord.findUniqueOrThrow({ where: { id: saved.recordId } })).enterpriseId).toBe(enterprise.id);
    const bad = input(); bad.review.command.batchId = batch.id;
    await expect(otherService.create(other.scope.farmId, bad)).rejects.toMatchObject(denied);
  });

  // Test-only owner clock shift. Trigger disabling and all changes are transactional, scoped to this draft.
  async function shiftBack(draftId: string) {
    await mine.owner.$transaction(async tx => {
      await tx.$executeRawUnsafe('ALTER TABLE "VoiceExpenseDraft" DISABLE TRIGGER myfarm_guard_voice_draft');
      await tx.$executeRaw`UPDATE "VoiceExpenseDraft" SET "createdAt" = "createdAt" - interval '1 hour',
        "expiresAt" = "expiresAt" - interval '1 hour', "confirmedAt" = "confirmedAt" - interval '1 hour' WHERE id = ${draftId}::uuid`;
      await tx.$executeRawUnsafe('ALTER TABLE "VoiceExpenseDraft" ENABLE TRIGGER myfarm_guard_voice_draft');
    });
  }
  it("refuses expired unconfirmed drafts for read, edit and confirmation", async () => {
    const draft = await create(); await shiftBack(draft.draftId);
    await expect(service.outcome(mine.scope.farmId, draft.draftId)).resolves.toEqual({ status: "EXPIRED" });
    await expect(service.read(mine.scope.farmId, draft.draftId)).rejects.toMatchObject(conflict);
    await expect(service.edit(mine.scope.farmId, draft.draftId, { review: draft.review, version: 1 })).rejects.toMatchObject(conflict);
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(conflict);
  });

  it("replays a completed receipt after expiry, but denies replay and new confirmation after revocation", async () => {
    const done = await create(), waiting = await create();
    const saved = await service.confirm(mine.scope.farmId, done.draftId, confirmation(done));
    await shiftBack(done.draftId);
    const replay = await service.confirm(mine.scope.farmId, done.draftId, confirmation(done));
    expect(replay.recordId).toBe(saved.recordId);
    await mine.owner.farmMember.update({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: mine.scope.actorId } }, data: { status: "REVOKED" } });
    try {
      await expect(service.confirm(mine.scope.farmId, done.draftId, confirmation(done))).rejects.toMatchObject(denied);
      await expect(repo().confirm(mine.scope, waiting.draftId, confirmation(waiting))).rejects.toMatchObject(denied);
    } finally {
      await mine.owner.farmMember.update({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: mine.scope.actorId } }, data: { status: "ACTIVE" } });
    }
  });

  it("revalidates a category retired after review and rolls back the claimed receipt", async () => {
    const category = await mine.owner.transactionCategory.create({ data: { id: crypto.randomUUID(), name: "Voice rollback " + crypto.randomUUID(), kind: "COST" } });
    customCategories.push(category.id);
    const command = input(); command.review.command.categoryId = category.id;
    const draft = await service.create(mine.scope.farmId, command);
    await mine.owner.transactionCategory.update({ where: { id: category.id }, data: { active: false } });
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(conflict);
    expect(await mine.owner.auditEvent.count({ where: { action: "ACCOUNTING_EXPENSE_RECORDED", requestId: command.review.command.requestId } })).toBe(0);
    expect((await mine.owner.voiceExpenseDraft.findUniqueOrThrow({ where: { id: draft.draftId } })).confirmedAt).toBeNull();
  });

  it("a late failure rolls back confirmation, expense and receipts, then retry succeeds", async () => {
    const draft = await create(), requestId = draft.review.command.requestId;
    const before = await mine.owner.accountingRecord.count();
    await mine.owner.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT voice_test_abort CHECK ("requestId" IS DISTINCT FROM '${requestId}'::uuid OR action <> 'VOICE_EXPENSE_CONFIRMED')`);
    try {
      await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toThrow();
      expect(await mine.owner.accountingRecord.count()).toBe(before);
      expect(await mine.owner.auditEvent.count({ where: { action: "ACCOUNTING_EXPENSE_RECORDED", requestId } })).toBe(0);
      expect((await mine.owner.voiceExpenseDraft.findUniqueOrThrow({ where: { id: draft.draftId } })).accountingRecordId).toBeNull();
    } finally { await mine.owner.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT voice_test_abort'); }
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).resolves.toHaveProperty("recordId");
  });

  it("refuses a request key already used by a normal expense, without attaching that record", async () => {
    const draft = await create();
    await farmAccountingRepository(mine.runtime).recordTransaction(mine.scope, "EXPENSE", draft.review.command);
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(conflict);
    expect((await mine.owner.voiceExpenseDraft.findUniqueOrThrow({ where: { id: draft.draftId } })).accountingRecordId).toBeNull();
  });

  it("prevents DB writes from changing scope/expiry or editing a completed confirmation; browsers have no access", async () => {
    const draft = await create();
    await expect(mine.runtime.$executeRaw`UPDATE "VoiceExpenseDraft" SET "actorId" = ${other.scope.actorId}::uuid WHERE id = ${draft.draftId}::uuid`).rejects.toThrow();
    await expect(mine.runtime.$executeRaw`UPDATE "VoiceExpenseDraft" SET "expiresAt" = "expiresAt" + interval '1 minute' WHERE id = ${draft.draftId}::uuid`).rejects.toThrow();
    await expect(mine.runtime.voiceExpenseDraft.delete({ where: { id: draft.draftId } })).rejects.toThrow();
    await service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft));
    await expect(mine.owner.voiceExpenseDraft.update({ where: { id: draft.draftId }, data: { version: 2 } })).rejects.toThrow();
    const grants = await mine.owner.$queryRaw<{ role: string; allowed: boolean }[]>`SELECT role, has_table_privilege(role, '"VoiceExpenseDraft"', 'SELECT,INSERT,UPDATE,DELETE') AS allowed FROM (VALUES ('anon'), ('authenticated')) AS roles(role)`;
    expect(grants.every(g => !g.allowed)).toBe(true);
  });

  it("serializes competing edits and invalidates confirmation when only the currency changes", async () => {
    const draft = await create();
    const edits = await Promise.allSettled(["USD", "KES"].map(currency => service.edit(mine.scope.farmId, draft.draftId,
      { version: 1, review: { ...draft.review, command: { ...draft.review.command, currency } } })));
    expect(edits.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(edits.filter(r => r.status === "rejected")).toHaveLength(1);
    await expect(service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft))).rejects.toMatchObject(conflict);
  });

  it("refuses expiry and membership revocation that occur while confirmation waits for the draft lock", async () => {
    for (const revoke of [false, true]) {
      const draft = await create();
      let start!: () => void, release!: () => void;
      const acquired = new Promise<void>(resolve => { start = resolve; });
      const unlocked = new Promise<void>(resolve => { release = resolve; });
      const blocker = mine.owner.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "VoiceExpenseDraft" WHERE id = ${draft.draftId}::uuid FOR UPDATE`;
        if (!revoke) {
          await tx.$executeRawUnsafe('ALTER TABLE "VoiceExpenseDraft" DISABLE TRIGGER myfarm_guard_voice_draft');
          await tx.$executeRaw`UPDATE "VoiceExpenseDraft" SET "createdAt" = "createdAt" - interval '1 hour', "expiresAt" = "expiresAt" - interval '1 hour' WHERE id = ${draft.draftId}::uuid`;
          await tx.$executeRawUnsafe('ALTER TABLE "VoiceExpenseDraft" ENABLE TRIGGER myfarm_guard_voice_draft');
        } else {
          await tx.farmMember.update({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: mine.scope.actorId } }, data: { status: "REVOKED" } });
        }
        start(); await unlocked;
      }, { timeout: 10_000 });
      await acquired;
      const attempt = repo().confirm(mine.scope, draft.draftId, confirmation(draft)).then(value => ({ value, error: undefined }), (error: unknown) => ({ value: undefined, error }));
      // Observe the actual lock wait rather than relying on an arbitrary delay.
      try {
        let waiting = false;
        for (let n = 0; n < 100 && !waiting; n++) {
          const [row] = await mine.owner.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%VoiceExpenseDraft%' AND query LIKE '%FOR UPDATE%'
          ) AS waiting`;
          waiting = row.waiting;
          if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
        }
        expect(waiting).toBe(true);
      } finally { release(); await blocker; }
      try {
        expect((await attempt).error).toMatchObject(revoke ? denied : conflict);
        expect(await mine.owner.auditEvent.count({ where: { requestId: draft.review.command.requestId, action: "ACCOUNTING_EXPENSE_RECORDED" } })).toBe(0);
      } finally {
        if (revoke) await mine.owner.farmMember.update({ where: { farmId_userId: { farmId: mine.scope.farmId, userId: mine.scope.actorId } }, data: { status: "ACTIVE" } });
      }
    }
  });

  it("normalizes UUID mutation keys before persistence and refuses changed creation retries", async () => {
    const command = input(); command.review.command.requestId = command.review.command.requestId.toUpperCase();
    const draft = await service.create(mine.scope.farmId, command);
    expect(draft.review.command.requestId).toBe(command.review.command.requestId.toLowerCase());
    await expect(service.create(mine.scope.farmId, command)).resolves.toEqual(draft);
    await expect(service.create(mine.scope.farmId, { review: { ...command.review, command: { ...command.review.command, amount: "1" } } })).rejects.toMatchObject(conflict);
    await expect(service.confirm(mine.scope.farmId, draft.draftId, { ...confirmation(draft), requestId: command.review.command.requestId })).resolves.toHaveProperty("recordId");
  });

  it("returns authoritative names for every chosen link and no other farm's names (T005)", async () => {
    const command = input();
    command.review.command.plotId = mine.cycle.plotId;
    command.review.command.enterpriseId = mine.cycle.enterpriseId;
    command.review.command.seasonId = mine.cycle.seasonId;
    const draft = await service.create(mine.scope.farmId, command);
    expect(draft.labels).toMatchObject({ plot: "Plot", enterprise: "Maize", season: "2026" });
    expect(draft.labels.category.length).toBeGreaterThan(0);
    expect(JSON.stringify(draft.labels)).not.toContain(other.scope.farmId);
  });
  it("rechecks account and organization status on confirmed replay as well as pending execution (T005)", async () => {
    const draft = await create(); await service.confirm(mine.scope.farmId, draft.draftId, confirmation(draft));
    await mine.owner.user.update({ where: { id: mine.scope.actorId }, data: { status: "SUSPENDED" } });
    try { await expect(repo().confirm(mine.scope, draft.draftId, confirmation(draft))).rejects.toMatchObject(denied); }
    finally { await mine.owner.user.update({ where: { id: mine.scope.actorId }, data: { status: "ACTIVE" } }); }
    await mine.owner.membership.update({ where: { userId_organizationId: { userId: mine.scope.actorId, organizationId: mine.scope.tenantId } }, data: { status: "REVOKED" } });
    try { await expect(repo().confirm(mine.scope, draft.draftId, confirmation(draft))).rejects.toMatchObject(denied); }
    finally { await mine.owner.membership.update({ where: { userId_organizationId: { userId: mine.scope.actorId, organizationId: mine.scope.tenantId } }, data: { status: "ACTIVE" } }); }
  });

});
