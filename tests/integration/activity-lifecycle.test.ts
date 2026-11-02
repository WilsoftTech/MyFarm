import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityFixture } from "../support/activity-fixture";

let f: Awaited<ReturnType<typeof activityFixture>>;
beforeAll(async () => { f = await activityFixture(); }, 30_000);
afterAll(async () => { if (f) await f.cleanup(); });
const farmA = () => f.a.scope.farmId;
const finish = () => ({ requestId: crypto.randomUUID(), expectedVersion: 1 });
const cancel = () => ({ ...finish(), confirmed: true as const });
async function cost(kind: "EXPENSE" | "PURCHASE" | "SALE" = "EXPENSE", member = f.a) {
  const category = await f.owner.transactionCategory.findFirstOrThrow({ where: { kind: kind === "SALE" ? "REVENUE" : "COST" } });
  return f.owner.accountingRecord.create({ data: { id: crypto.randomUUID(), tenantId: member.scope.tenantId, farmId: member.scope.farmId, kind, categoryId: category.id, categoryName: category.name, amount: "150000.0000", currency: "UGX", occurredOn: new Date("2026-11-01Z"), createdBy: member.scope.actorId } });
}

describe("MYF-P06-AC002 activity states on the farm date", () => {
  it("shows Plot B fertilizer due tomorrow as upcoming, then today, then missed in Africa/Kampala", async () => {
    f.setNow("2026-11-02T09:00:00Z");
    const row = await f.a.activities.schedule(farmA(), f.command());
    expect(row).toMatchObject({ plotName: "Plot B", typeLabel: "Fertilizing", state: "UPCOMING" });
    f.setNow("2026-11-02T21:00:00Z");
    expect((await f.a.activities.detail(farmA(), row.activityId)).state).toBe("TODAY");
    f.setNow("2026-11-03T20:59:59Z");
    expect((await f.a.activities.detail(farmA(), row.activityId)).state).toBe("TODAY");
    f.setNow("2026-11-03T21:00:00Z");
    expect((await f.a.activities.detail(farmA(), row.activityId)).state).toBe("MISSED");
    f.setNow("2026-11-02T09:00:00Z");
  });
  it("files each activity in exactly one bucket and pages it without crossing buckets or farms", async () => {
    const before = await f.a.activities.list(farmA(), { bucket: "UPCOMING", limit: 50 });
    const days = ["2026-11-20", "2026-11-21", "2026-11-22"];
    const made = await Promise.all(days.map(dueOn => f.a.activities.schedule(farmA(), f.command({ dueOn }))));
    const missed = await f.a.activities.schedule(farmA(), f.command({ dueOn: "2026-10-30" }));
    const today = await f.a.activities.schedule(farmA(), f.command({ dueOn: "2026-11-02" }));
    await f.b.activities.schedule(f.b.scope.farmId, f.command({ type: "CLEANING", enterpriseId: undefined, plotId: undefined, dueOn: "2026-11-20" }));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page: Awaited<ReturnType<typeof f.a.activities.list>> = await f.a.activities.list(farmA(), { bucket: "UPCOMING", limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map(row => row.activityId));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(before.items.length + 3);
    expect(new Set(seen).size).toBe(seen.length);
    for (const row of made) expect(seen).toContain(row.activityId);
    expect((await f.a.activities.list(farmA(), { bucket: "MISSED" })).items.map(row => row.activityId)).toContain(missed.activityId);
    expect((await f.a.activities.list(farmA(), { bucket: "TODAY" })).items.map(row => row.activityId)).toEqual([today.activityId]);
    await expect(f.a.activities.list(farmA(), { bucket: "MISSED", cursor: made[0].activityId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("MYF-P06-AC002 completion", () => {
  it("records the signed-in member, the server time and an optional free-text worker", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    const before = Date.now();
    const done = await f.a.activities.complete(farmA(), row.activityId, { ...finish(), workerName: " Okello ", notes: "Top dressing" });
    expect(done).toMatchObject({ status: "COMPLETED", state: "COMPLETED", completedBy: f.a.scope.actorId, workerName: "Okello", notes: "Top dressing", version: 2 });
    expect(Date.parse(done.completedAt ?? "")).toBeGreaterThanOrEqual(before - 5_000);
    expect((await f.a.activities.list(farmA(), { bucket: "COMPLETED" })).items.map(item => item.activityId)).toContain(row.activityId);
  });
  it("completes a missed activity late and keeps the original due date", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command({ dueOn: "2026-10-01" }));
    expect(row.state).toBe("MISSED");
    expect(await f.a.activities.complete(farmA(), row.activityId, finish())).toMatchObject({ status: "COMPLETED", dueOn: "2026-10-01" });
  });
  it("keeps scheduled details when completion supplies none", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command({ workerName: "Akello", notes: "Row 3" }));
    expect(await f.a.activities.complete(farmA(), row.activityId, finish())).toMatchObject({ workerName: "Akello", notes: "Row 3" });
  });
  it("replays one completion under concurrent retries and conflicts on a different request", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    const command = finish();
    const [one, two] = await Promise.all([f.a.activities.complete(farmA(), row.activityId, command), f.a.activities.complete(farmA(), row.activityId, command)]);
    expect(one).toEqual(two);
    expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(1);
    await expect(f.a.activities.complete(farmA(), row.activityId, finish())).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("lets only one of two concurrent completions win", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    const results = await Promise.allSettled([f.a.activities.complete(farmA(), row.activityId, finish()), f.a.activities.complete(farmA(), row.activityId, finish())]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect((await f.a.activities.detail(farmA(), row.activityId)).version).toBe(2);
  });
  it("refuses a stale version, a cancelled activity and a foreign activity", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    await expect(f.a.activities.complete(farmA(), row.activityId, { ...finish(), expectedVersion: 9 })).rejects.toMatchObject({ code: "CONFLICT" });
    await f.a.activities.cancel(farmA(), row.activityId, cancel());
    await expect(f.a.activities.complete(farmA(), row.activityId, { ...finish(), expectedVersion: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
    const foreign = await f.b.activities.schedule(f.b.scope.farmId, f.command({ type: "CLEANING", enterpriseId: undefined, plotId: undefined }));
    const command = finish();
    await expect(f.a.activities.complete(farmA(), foreign.activityId, command)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
    await expect(f.b.activities.complete(farmA(), row.activityId, finish())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("denies a member whose access was revoked after opening the form", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "REVOKED" } });
    try { await expect(f.a.activities.complete(farmA(), row.activityId, finish())).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "ACTIVE" } }); }
    expect((await f.a.activities.detail(farmA(), row.activityId)).status).toBe("SCHEDULED");
  });
});

describe("cancellation", () => {
  it("keeps a cancelled activity in history with who, when and why", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    expect(await f.a.activities.cancel(farmA(), row.activityId, { ...cancel(), reason: "Rain" })).toMatchObject({ status: "CANCELLED", state: "CANCELLED", cancelledBy: f.a.scope.actorId, cancelReason: "Rain", completedAt: null });
    expect((await f.a.activities.list(farmA(), { bucket: "CANCELLED" })).items.map(item => item.activityId)).toContain(row.activityId);
    expect((await f.a.activities.list(farmA(), { bucket: "UPCOMING", limit: 50 })).items.map(item => item.activityId)).not.toContain(row.activityId);
  });
  it("cannot cancel a completed activity", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    await f.a.activities.complete(farmA(), row.activityId, finish());
    await expect(f.a.activities.cancel(farmA(), row.activityId, { ...cancel(), expectedVersion: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("D-P06-005 cost link", () => {
  it("shows the linked accounting amount and never creates or changes money", async () => {
    const record = await cost("PURCHASE");
    const count = await f.owner.accountingRecord.count({ where: { tenantId: f.a.scope.tenantId } });
    const row = await f.a.activities.schedule(farmA(), f.command({ costRecordId: record.id }));
    expect(row.cost).toEqual({ recordId: record.id, kind: "PURCHASE", categoryName: record.categoryName, amount: "150000", currency: "UGX", occurredOn: "2026-11-01", reversed: false });
    const done = await f.a.activities.complete(farmA(), row.activityId, finish());
    expect(done.cost?.amount).toBe("150000");
    expect(await f.owner.accountingRecord.count({ where: { tenantId: f.a.scope.tenantId } })).toBe(count);
    expect((await f.owner.accountingRecord.findUniqueOrThrow({ where: { id: record.id } })).version).toBe(1);
  });
  it("links at completion and shows a later reversal on the activity", async () => {
    const record = await cost();
    const row = await f.a.activities.schedule(farmA(), f.command());
    expect((await f.a.activities.complete(farmA(), row.activityId, { ...finish(), costRecordId: record.id })).cost?.reversed).toBe(false);
    await f.owner.accountingRecord.update({ where: { id: record.id }, data: { status: "REVERSED" } });
    expect((await f.a.activities.detail(farmA(), row.activityId)).cost?.reversed).toBe(true);
  });
  it("refuses a sale, a reversed record and another farm's record without a receipt", async () => {
    const sale = await cost("SALE"), reversed = await cost(), foreign = await cost("EXPENSE", f.b);
    await f.owner.accountingRecord.update({ where: { id: reversed.id }, data: { status: "REVERSED" } });
    const cases = [[sale.id, "INVALID_INPUT"], [reversed.id, "CONFLICT"], [foreign.id, "FORBIDDEN"]] as const;
    for (const [costRecordId, code] of cases) {
      const command = f.command({ costRecordId });
      await expect(f.a.activities.schedule(farmA(), command)).rejects.toMatchObject({ code });
      expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
      const row = await f.a.activities.schedule(farmA(), f.command());
      await expect(f.a.activities.complete(farmA(), row.activityId, { ...finish(), costRecordId })).rejects.toMatchObject({ code });
      expect((await f.a.activities.detail(farmA(), row.activityId)).status).toBe("SCHEDULED");
    }
  });
});

describe("database rules", () => {
  it("lets the runtime role change only lifecycle columns, and only while scheduled", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    await expect(f.runtime.productionActivity.update({ where: { id: row.activityId }, data: { dueOn: new Date("2030-01-01Z") } })).rejects.toThrow();
    await expect(f.runtime.productionActivity.delete({ where: { id: row.activityId } })).rejects.toThrow();
    await f.a.activities.complete(farmA(), row.activityId, finish());
    const reopen = await f.runtime.productionActivity.updateMany({ where: { id: row.activityId }, data: { status: "SCHEDULED", completedAt: null, completedBy: null } });
    expect(reopen.count).toBe(0);
    expect((await f.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } })).status).toBe("COMPLETED");
  });
  it("rejects inconsistent lifecycle rows and foreign cost links", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command());
    await expect(f.owner.productionActivity.update({ where: { id: row.activityId }, data: { status: "COMPLETED" } })).rejects.toThrow();
    await expect(f.owner.productionActivity.update({ where: { id: row.activityId }, data: { status: "CANCELLED", completedAt: new Date(), completedBy: f.a.scope.actorId, cancelledAt: new Date(), cancelledBy: f.a.scope.actorId } })).rejects.toThrow();
    const foreign = await cost("EXPENSE", f.b);
    await expect(f.runtime.productionActivity.updateMany({ where: { id: row.activityId }, data: { status: "COMPLETED", completedAt: new Date(), completedBy: f.a.scope.actorId, costRecordId: foreign.id } })).rejects.toThrow();
  });
});
