import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { activityFixture } from "../support/activity-fixture";

let f: Awaited<ReturnType<typeof activityFixture>>;
beforeAll(async () => { f = await activityFixture(); }, 30_000);
afterAll(async () => { if (f) await f.cleanup(); });
beforeEach(() => f.setNow("2026-11-02T09:00:00Z"));
const farmA = () => f.a.scope.farmId;
const series = (overrides: Record<string, unknown> = {}) => ({ requestId: crypto.randomUUID(), type: "FEEDING", frequency: "DAILY", interval: 1, startOn: "2026-11-02", enterpriseId: f.a.poultry.id, ...overrides });
const dueDates = async (recurrenceId: string, status?: "SCHEDULED" | "COMPLETED" | "CANCELLED") => (await f.owner.productionActivity.findMany({ where: { recurrenceId, ...(status ? { status } : {}) }, orderBy: { dueOn: "asc" }, select: { dueOn: true } })).map(row => row.dueOn.toISOString().slice(0, 10));
const stop = (stopFrom: string, expectedVersion = 1) => ({ requestId: crypto.randomUUID(), expectedVersion, stopFrom, confirmed: true as const });

describe("MYF-P06-AC003 expansion", () => {
  it("generates one occurrence per due date up to 30 days ahead when the series starts", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const dates = await dueDates(row.recurrenceId);
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe("2026-11-02");
    expect(dates[30]).toBe("2026-12-02");
    expect(new Set(dates).size).toBe(31);
  });
  it("creates nothing more when repeated, sequentially or concurrently", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const before = await dueDates(row.recurrenceId);
    await f.a.recurrences.expand(farmA());
    await Promise.all([f.a.recurrences.expand(farmA()), f.a.recurrences.expand(farmA()), f.a.recurrences.expand(farmA())]);
    expect(await dueDates(row.recurrenceId)).toEqual(before);
  });
  it("adds only the new dates as the days pass, across a month boundary", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    f.setNow("2026-11-04T21:30:00Z"); // 5 November in Kampala.
    await f.a.recurrences.expand(farmA());
    const dates = await dueDates(row.recurrenceId);
    expect(dates).toHaveLength(34);
    expect(dates.at(-1)).toBe("2026-12-05");
  });
  it("the database refuses a second occurrence on the same date", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    await expect(f.owner.productionActivity.create({ data: { id: crypto.randomUUID(), tenantId: f.a.scope.tenantId, farmId: farmA(), type: "FEEDING", dueOn: new Date("2026-11-02Z"), recurrenceId: row.recurrenceId, requestHash: "x", createdBy: f.a.scope.actorId } })).rejects.toMatchObject({ code: "P2002" });
  });
  it("respects the end date and monthly short months", async () => {
    const row = await f.a.recurrences.create(farmA(), series({ type: "VACCINATION", frequency: "MONTHLY", startOn: "2026-12-31", endOn: "2027-03-31" }));
    f.setNow("2027-03-15T09:00:00Z");
    await f.a.recurrences.expand(farmA());
    expect(await dueDates(row.recurrenceId)).toEqual(["2026-12-31", "2027-01-31", "2027-02-28", "2027-03-31"]);
    f.setNow("2027-04-30T09:00:00Z");
    await f.a.recurrences.expand(farmA());
    expect(await dueDates(row.recurrenceId)).toHaveLength(4);
  });
  it("shows generated occurrences through the normal activity lists, without another farm's", async () => {
    const row = await f.a.recurrences.create(farmA(), series({ type: "CLEANING" }));
    await f.b.recurrences.create(f.b.scope.farmId, series({ type: "CLEANING", enterpriseId: f.b.poultry.id }));
    const page = await f.a.activities.list(farmA(), { recurrenceId: row.recurrenceId, bucket: "TODAY" });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ recurrenceId: row.recurrenceId, typeLabel: "Cleaning", state: "TODAY", enterpriseName: "Layers" });
  });
  it("leaves a closed enterprise's series ungenerated until it is active again", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const count = (await dueDates(row.recurrenceId)).length;
    await f.owner.enterprise.update({ where: { id: f.a.poultry.id }, data: { status: "CLOSED" } });
    try {
      f.setNow("2026-11-20T09:00:00Z");
      await f.a.recurrences.expand(farmA());
      expect(await dueDates(row.recurrenceId)).toHaveLength(count);
    } finally { await f.owner.enterprise.update({ where: { id: f.a.poultry.id }, data: { status: "ACTIVE" } }); }
  });
});

describe("MYF-P06-AC003 stopping and skipping", () => {
  it("stops future entries, keeps earlier and completed history and never generates again", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const first = (await f.a.activities.list(farmA(), { recurrenceId: row.recurrenceId, bucket: "TODAY" })).items[0];
    await f.a.activities.complete(farmA(), first.activityId, { requestId: crypto.randomUUID(), expectedVersion: 1 });
    const stopped = await f.a.recurrences.stop(farmA(), row.recurrenceId, stop("2026-11-05"));
    expect(stopped).toMatchObject({ stoppedFrom: "2026-11-05", version: 2 });
    expect(await dueDates(row.recurrenceId, "COMPLETED")).toEqual(["2026-11-02"]);
    expect(await dueDates(row.recurrenceId, "SCHEDULED")).toEqual(["2026-11-03", "2026-11-04"]);
    const cancelled = await dueDates(row.recurrenceId, "CANCELLED");
    expect(cancelled[0]).toBe("2026-11-05");
    expect(cancelled).toHaveLength(28);
    const total = (await dueDates(row.recurrenceId)).length;
    f.setNow("2026-12-20T09:00:00Z");
    await f.a.recurrences.expand(farmA());
    expect(await dueDates(row.recurrenceId)).toHaveLength(total);
  });
  it("replays a stop and refuses a stale or repeated one", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const command = stop("2026-11-05");
    const [one, two] = await Promise.all([f.a.recurrences.stop(farmA(), row.recurrenceId, command), f.a.recurrences.stop(farmA(), row.recurrenceId, command)]);
    expect(one).toEqual(two);
    await expect(f.a.recurrences.stop(farmA(), row.recurrenceId, stop("2026-11-06", 2))).rejects.toMatchObject({ code: "CONFLICT" });
    const other = await f.a.recurrences.create(farmA(), series());
    await expect(f.a.recurrences.stop(farmA(), other.recurrenceId, stop("2026-11-05", 9))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(f.a.recurrences.stop(farmA(), other.recurrenceId, stop("2026-11-01"))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("a concurrent stop and expansion leave nothing scheduled past the stop date", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    f.setNow("2026-11-10T09:00:00Z");
    await Promise.all([f.a.recurrences.stop(farmA(), row.recurrenceId, stop("2026-11-12")), f.a.recurrences.expand(farmA())]);
    expect((await dueDates(row.recurrenceId, "SCHEDULED")).filter(date => date >= "2026-11-12")).toEqual([]);
  });
  it("a skipped occurrence stays skipped through later expansion", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const target = (await f.a.activities.list(farmA(), { recurrenceId: row.recurrenceId, bucket: "UPCOMING", limit: 1 })).items[0];
    await f.a.activities.cancel(farmA(), target.activityId, { requestId: crypto.randomUUID(), expectedVersion: 1, confirmed: true });
    f.setNow("2026-11-20T09:00:00Z");
    await f.a.recurrences.expand(farmA());
    expect(await dueDates(row.recurrenceId, "CANCELLED")).toEqual([target.dueOn]);
  });
});

describe("MYF-P06-AC003 changes affect future entries only", () => {
  const change = (overrides: Record<string, unknown> = {}) => ({ requestId: crypto.randomUUID(), expectedVersion: 1, effectiveFrom: "2026-11-06", frequency: "WEEKLY", interval: 1, ...overrides });
  it("keeps earlier occurrences and continues in a linked series from the change date", async () => {
    const row = await f.a.recurrences.create(farmA(), series({ workerName: "Okello" }));
    const next = await f.a.recurrences.change(farmA(), row.recurrenceId, change({ workerName: "Akello" }));
    expect(next).toMatchObject({ previousId: row.recurrenceId, startOn: "2026-11-06", frequency: "WEEKLY", workerName: "Akello", type: "FEEDING", enterpriseName: "Layers" });
    expect(await dueDates(row.recurrenceId, "SCHEDULED")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
    expect((await dueDates(next.recurrenceId, "SCHEDULED")).slice(0, 2)).toEqual(["2026-11-06", "2026-11-13"]);
    expect((await f.a.recurrences.detail(farmA(), row.recurrenceId)).stoppedFrom).toBe("2026-11-06");
    const kept = await f.owner.productionActivity.findFirstOrThrow({ where: { recurrenceId: row.recurrenceId, status: "SCHEDULED" } });
    expect(kept.workerName).toBe("Okello");
  });
  it("replays a change once and refuses a stale or conflicting one", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const command = change();
    const [one, two] = await Promise.all([f.a.recurrences.change(farmA(), row.recurrenceId, command), f.a.recurrences.change(farmA(), row.recurrenceId, command)]);
    expect(one).toEqual(two);
    expect(await f.owner.activityRecurrence.count({ where: { previousId: row.recurrenceId } })).toBe(1);
    await expect(f.a.recurrences.change(farmA(), row.recurrenceId, change({ expectedVersion: 2 }))).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("refuses a change date before a completed occurrence, and a past date", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const done = (await f.a.activities.list(farmA(), { recurrenceId: row.recurrenceId, bucket: "UPCOMING", limit: 3 })).items[2];
    await f.a.activities.complete(farmA(), done.activityId, { requestId: crypto.randomUUID(), expectedVersion: 1 });
    await expect(f.a.recurrences.change(farmA(), row.recurrenceId, change({ effectiveFrom: done.dueOn }))).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(f.a.recurrences.change(farmA(), row.recurrenceId, change({ effectiveFrom: "2026-11-01" }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await f.a.recurrences.detail(farmA(), row.recurrenceId)).stoppedFrom).toBeNull();
  });
  it("keeps dates the farmer already skipped under the new pattern", async () => {
    const row = await f.a.recurrences.create(farmA(), series());
    const skip = (await f.owner.productionActivity.findFirstOrThrow({ where: { recurrenceId: row.recurrenceId, dueOn: new Date("2026-11-13Z") } })).id;
    await f.a.activities.cancel(farmA(), skip, { requestId: crypto.randomUUID(), expectedVersion: 1, confirmed: true });
    const next = await f.a.recurrences.change(farmA(), row.recurrenceId, change());
    expect(await dueDates(next.recurrenceId, "CANCELLED")).toEqual(["2026-11-13"]);
    expect((await dueDates(next.recurrenceId, "SCHEDULED")).slice(0, 2)).toEqual(["2026-11-06", "2026-11-20"]);
  });
});

describe("recurrence authorization and retries", () => {
  it("replays an offline retry into one series and conflicts when the payload changed", async () => {
    const command = series();
    const [one, two] = await Promise.all([f.a.recurrences.create(farmA(), command), f.a.recurrences.create(farmA(), command)]);
    expect(one).toEqual(two);
    expect(await dueDates(one.recurrenceId)).toHaveLength(31);
    await expect(f.a.recurrences.create(farmA(), { ...command, interval: 2 })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([
    [{ type: "WEEDING" }, "INVALID_INPUT"],
    [{ type: "MILKING" }, "INVALID_INPUT"],
    [{ type: "FEEDING", enterpriseId: undefined, startOn: "2026-11-01" }, "INVALID_INPUT"],
  ])("refuses %j without a receipt", async (overrides, code) => {
    const command = series(overrides);
    await expect(f.a.recurrences.create(farmA(), command)).rejects.toMatchObject({ code });
    expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
  });
  it("refuses a crop enterprise for feeding and an unsupported enterprise", async () => {
    await expect(f.a.recurrences.create(farmA(), series({ enterpriseId: f.a.crop.id }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(f.a.recurrences.create(farmA(), series({ enterpriseId: f.a.fish.id }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("denies foreign farms, parents and series", async () => {
    const own = await f.a.recurrences.create(farmA(), series());
    await expect(f.b.recurrences.create(farmA(), series())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.a.recurrences.create(farmA(), series({ enterpriseId: f.b.poultry.id }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.a.recurrences.create(farmA(), series({ plotId: f.b.plot.id }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.b.recurrences.stop(f.b.scope.farmId, own.recurrenceId, stop("2026-11-05"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.b.recurrences.detail(f.b.scope.farmId, own.recurrenceId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.b.recurrences.expand(farmA())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await f.a.recurrences.detail(farmA(), own.recurrenceId)).stoppedFrom).toBeNull();
  });
  it("denies a revoked member from every write", async () => {
    const own = await f.a.recurrences.create(farmA(), series());
    await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "REVOKED" } });
    try {
      await expect(f.a.recurrences.expand(farmA())).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(f.a.recurrences.stop(farmA(), own.recurrenceId, stop("2026-11-05"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally { await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "ACTIVE" } }); }
  });
  it("lets the runtime role change only series progress columns and never restart a stopped series", async () => {
    const own = await f.a.recurrences.create(farmA(), series());
    await expect(f.runtime.activityRecurrence.update({ where: { id: own.recurrenceId }, data: { interval: 9 } })).rejects.toThrow();
    await expect(f.runtime.activityRecurrence.delete({ where: { id: own.recurrenceId } })).rejects.toThrow();
    await f.a.recurrences.stop(farmA(), own.recurrenceId, stop("2026-11-05"));
    expect((await f.runtime.activityRecurrence.updateMany({ where: { id: own.recurrenceId }, data: { stoppedFrom: null } })).count).toBe(0);
    const rows = await f.owner.$queryRaw<{ browser: boolean; rls: boolean }[]>`SELECT has_table_privilege('authenticated','public."ActivityRecurrence"','SELECT') AS browser, (SELECT relrowsecurity FROM pg_class WHERE oid='public."ActivityRecurrence"'::regclass) AS rls`;
    expect(rows[0]).toEqual({ browser: false, rls: true });
  });
});
