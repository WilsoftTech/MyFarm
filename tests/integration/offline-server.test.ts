import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityFixture } from "../support/activity-fixture";
import { PullService, PushService, applySyncCommand, type SyncCommandServices } from "@/modules/offline-first/application/sync";
import { PhotoService } from "@/modules/offline-first/application/photos";
import { photoRepository } from "@/modules/offline-first/infrastructure/photo-repository";
import { pullSources } from "@/modules/offline-first/infrastructure/pull-sources";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { PULL_LIMITS, PULL_SECTIONS, encodePullCursor } from "@/modules/offline-first/domain/commands";
import type { PullPage } from "@/modules/offline-first/contracts/commands";

let f: Awaited<ReturnType<typeof activityFixture>>;
type Member = Awaited<ReturnType<typeof activityFixture>>["a"];
const id = () => crypto.randomUUID();
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const storedObjects = new Map<string, Uint8Array>();
let storageDown = false;
const services = (m: Member): SyncCommandServices => ({
  recordTransaction: (kind, farmId, input) => m.accounting.recordTransaction(kind, farmId, input),
  recordHarvest: (farmId, input) => m.harvest.record(farmId, input),
  scheduleActivity: (farmId, input) => m.activities.schedule(farmId, input),
  recordActivityDone: (farmId, input) => m.activities.recordDone(farmId, input),
  completeActivity: (farmId, activityId, input) => m.activities.complete(farmId, activityId, input),
  currentActivity: (farmId, activityId) => m.activities.detail(farmId, activityId),
});
const photos = (m: Member) => new PhotoService(m.auth, registryRepository(f.runtime), photoRepository(f.runtime), async () => ({ async put(tenantId, objectId, bytes) {
  if (storageDown) throw new Error("storage down");
  storedObjects.set(tenantId + "/" + objectId, bytes);
} }));
const puller = (m: Member, now?: () => Date) => new PullService(m.auth, pullSources({ registry: m.registryService, production: m.production, crops: m.crops, accounting: m.accounting, harvest: m.harvest, activities: m.activities }), now);
const walk = async (m: Member) => {
  const pages: Extract<PullPage, { status: "OK" }>[] = [];
  let cursor: string | null = null;
  do {
    const page: PullPage = await puller(m).pull(cursor ? { cursor } : {});
    if (page.status !== "OK") throw new Error("expired");
    pages.push(page); cursor = page.nextCursor;
  } while (cursor);
  return pages;
};
const category = (kind: "COST" | "REVENUE") => f.owner.transactionCategory.findFirstOrThrow({ where: { kind } });
const push = (operation: string, payload: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({ clientMutationId: id(), deviceId: id(), farmId: f.a.scope.farmId, operation, payload, baseVersion: null, createdAt: new Date().toISOString(), ...overrides }) as Parameters<typeof applySyncCommand>[1];

beforeAll(async () => { f = await activityFixture(); }, 30_000);
afterAll(async () => { if (f) await f.cleanup(); });

describe("MYF-P07-AC002 commands through existing services", () => {
  it("records an expense and income once each, through the real accounting rules", async () => {
    const expense = push("RECORD_EXPENSE", { categoryId: (await category("COST")).id, amount: "150000", currency: "UGX", occurredOn: "2026-11-01" });
    const [one, two] = await Promise.all([applySyncCommand(services(f.a), expense), applySyncCommand(services(f.a), expense)]);
    expect(one).toEqual(two);
    expect(await f.owner.accountingRecord.count({ where: { tenantId: f.a.scope.tenantId, id: String(one.recordId) } })).toBe(1);
    expect(await f.owner.auditEvent.count({ where: { requestId: expense.clientMutationId } })).toBe(1);
    const income = await applySyncCommand(services(f.a), push("RECORD_INCOME", { categoryId: (await category("REVENUE")).id, amount: "90000", currency: "UGX", occurredOn: "2026-11-01" }));
    expect(income.recordId).toEqual(expect.any(String));
  });
  it("records a harvest with its stock movements", async () => {
    const season = await f.owner.season.create({ data: { tenantId: f.a.scope.tenantId, farmId: f.a.scope.farmId, label: "Offline season", startDate: new Date("2026-03-01Z"), createdBy: f.a.scope.actorId } });
    const cycle = await f.owner.cropCycle.create({ data: { tenantId: f.a.scope.tenantId, farmId: f.a.scope.farmId, enterpriseId: f.a.crop.id, seasonId: season.id, plotId: f.a.plot.id, cropId: "f4030005-0000-4000-8000-000000000001", cropName: "Maize", areaPlanted: "1", areaUnit: "ACRE", plantingDate: new Date("2026-03-01Z"), createdBy: f.a.scope.actorId } });
    const store = await f.a.harvest.createLocation(f.a.scope.farmId, { requestId: id(), name: "Offline store" });
    const result = await applySyncCommand(services(f.a), push("RECORD_HARVEST", { cropCycleId: cycle.id, cropId: cycle.cropId, plotId: f.a.plot.id, storageLocationId: store.storageLocationId, harvestDate: "2026-10-01", quantity: "2400", unit: "KG", lossQuantity: "150" }));
    expect(await f.owner.stockMovement.count({ where: { harvestId: String(result.harvestId) } })).toBe(2);
  });
  it("creates a task, and records finished work in one atomic step", async () => {
    const task = await applySyncCommand(services(f.a), push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-20" }));
    expect(await f.a.activities.detail(f.a.scope.farmId, task.activityId)).toMatchObject({ status: "SCHEDULED", version: 1 });
    const done = push("RECORD_ACTIVITY", { type: "WEEDING", dueOn: "2026-11-01", enterpriseId: f.a.crop.id, workerName: "Okello" });
    const [one, two] = await Promise.all([applySyncCommand(services(f.a), done), applySyncCommand(services(f.a), done)]);
    expect(one).toEqual(two);
    expect(await f.a.activities.detail(f.a.scope.farmId, one.activityId)).toMatchObject({ status: "COMPLETED", version: 2, completedBy: f.a.scope.actorId, dueOn: "2026-11-01", workerName: "Okello" });
    expect(await f.owner.auditEvent.count({ where: { requestId: done.clientMutationId } })).toBe(1);
  });
  it("rolls back a refused done record so nothing is half saved", async () => {
    const done = push("RECORD_ACTIVITY", { type: "PLANTING", dueOn: "2026-11-01", enterpriseId: f.a.poultry.id });
    await expect(applySyncCommand(services(f.a), done)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await f.owner.auditEvent.count({ where: { requestId: done.clientMutationId } })).toBe(0);
  });
  it("uses the command's own ID, whatever the payload claims, and refuses foreign farms", async () => {
    const other = id();
    const command = push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-21", requestId: other });
    await applySyncCommand(services(f.a), command);
    expect(await f.owner.auditEvent.count({ where: { requestId: other } })).toBe(0);
    expect(await f.owner.auditEvent.count({ where: { requestId: command.clientMutationId } })).toBe(1);
    await expect(applySyncCommand(services(f.b), command)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("requires a base version to complete an activity and refuses photos through push", async () => {
    await expect(applySyncCommand(services(f.a), push("COMPLETE_ACTIVITY", { activityId: id() }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(applySyncCommand(services(f.a), push("ATTACH_PHOTO", {}))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("D-P07-004 photos", () => {
  const upload = async (m: Member, recordId: string, overrides: Record<string, unknown> = {}, bytes = jpeg) => photos(m).upload(m.scope.farmId, { requestId: id(), target: "ACTIVITY", recordId, contentType: "image/jpeg", sha256: sha(bytes), ...overrides }, bytes);
  const task = async () => (await f.a.activities.schedule(f.a.scope.farmId, f.command({ type: "CLEANING", enterpriseId: undefined, plotId: undefined }))).activityId;
  it("stores one private object per request and lists it for the record", async () => {
    const recordId = await task(), requestId = id();
    const [one, two] = await Promise.all([upload(f.a, recordId, { requestId }), upload(f.a, recordId, { requestId })].map(p => p.catch(error => error)));
    const row = [one, two].find(value => "photoId" in value) ?? one;
    expect(row).toMatchObject({ photoId: requestId, target: "ACTIVITY", recordId, byteSize: jpeg.length });
    expect(row).not.toHaveProperty("sha256");
    expect(await upload(f.a, recordId, { requestId })).toEqual(row);
    expect(storedObjects.get(f.a.scope.tenantId + "/" + requestId)).toEqual(jpeg);
    expect(await f.owner.recordPhoto.count({ where: { id: requestId } })).toBe(1);
    expect(await photos(f.a).list(f.a.scope.farmId, { target: "ACTIVITY", recordId })).toHaveLength(1);
  });
  it("attaches to a money record", async () => {
    const record = await f.a.accounting.recordTransaction("EXPENSE", f.a.scope.farmId, { requestId: id(), categoryId: (await category("COST")).id, amount: "1000", currency: "UGX", occurredOn: "2026-11-01" });
    expect(await upload(f.a, record.recordId, { target: "ACCOUNTING_RECORD" })).toMatchObject({ target: "ACCOUNTING_RECORD", recordId: record.recordId });
  });
  it("refuses a changed retry, wrong digest, non-image, wrong type and oversize photo", async () => {
    const recordId = await task(), requestId = id();
    await upload(f.a, recordId, { requestId });
    const changed = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9]);
    await expect(upload(f.a, recordId, { requestId }, changed)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(upload(f.a, recordId, { sha256: "0".repeat(64) })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const svg = new TextEncoder().encode("<svg></svg>");
    await expect(upload(f.a, recordId, {}, svg)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(upload(f.a, recordId, { contentType: "image/png" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const over = new Uint8Array(2 * 1024 * 1024 + 1); over.set(jpeg);
    await expect(upload(f.a, recordId, {}, over)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("keeps a failed upload retryable, with no row or receipt", async () => {
    const recordId = await task(), requestId = id();
    storageDown = true;
    await expect(upload(f.a, recordId, { requestId })).rejects.toThrow();
    storageDown = false;
    expect(await f.owner.recordPhoto.count({ where: { id: requestId } })).toBe(0);
    expect(await f.owner.auditEvent.count({ where: { requestId } })).toBe(0);
    expect(await upload(f.a, recordId, { requestId })).toMatchObject({ photoId: requestId });
  });
  it("refuses another farm's record and hides photos across farms", async () => {
    const recordId = await task(), requestId = id();
    await upload(f.a, recordId, { requestId });
    await expect(upload(f.b, recordId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(photos(f.b).readable(f.b.scope.farmId, requestId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(photos(f.b).list(f.a.scope.farmId, { target: "ACTIVITY", recordId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await photos(f.a).readable(f.a.scope.farmId, requestId)).toEqual({ tenantId: f.a.scope.tenantId, photoId: requestId });
  });
  it("keeps photos append-only, bound to their farm, with the storage policy in place", async () => {
    const recordId = await task(), requestId = id();
    await upload(f.a, recordId, { requestId });
    await expect(f.runtime.recordPhoto.delete({ where: { id: requestId } })).rejects.toThrow();
    await expect(f.runtime.recordPhoto.update({ where: { id: requestId }, data: { byteSize: 1 } })).rejects.toThrow();
    await expect(f.runtime.recordPhoto.create({ data: { id: id(), tenantId: f.a.scope.tenantId, farmId: f.a.scope.farmId, activityId: (await f.b.activities.schedule(f.b.scope.farmId, f.command({ type: "CLEANING", enterpriseId: undefined, plotId: undefined }))).activityId, contentType: "image/jpeg", byteSize: 1, sha256: "0".repeat(64), createdBy: f.a.scope.actorId } })).rejects.toThrow();
    await expect(f.owner.recordPhoto.create({ data: { id: id(), tenantId: f.a.scope.tenantId, farmId: f.a.scope.farmId, contentType: "image/jpeg", byteSize: 1, sha256: "0".repeat(64), createdBy: f.a.scope.actorId } })).rejects.toThrow();
    const rows = await f.owner.$queryRaw<{ browser: boolean; rls: boolean; insert: bigint }[]>`SELECT has_table_privilege('authenticated','public."RecordPhoto"','SELECT') AS browser, (SELECT relrowsecurity FROM pg_class WHERE oid='public."RecordPhoto"'::regclass) AS rls, (SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND policyname='myfarm_scoped_private_insert') AS insert`;
    expect(rows[0]).toMatchObject({ browser: false, rls: true });
    expect(Number(rows[0].insert)).toBe(1);
  });
});

describe("MYF-P07-AC002 cached data pull", () => {
  it("walks every section for the account's farm and carries one snapshot ID", async () => {
    const pages = await walk(f.a);
    expect(pages.map(page => page.section)).toEqual(expect.arrayContaining([...PULL_SECTIONS]));
    expect(new Set(pages.map(page => page.snapshotId)).size).toBe(1);
    expect(pages[0].farms).toEqual([{ farmId: f.a.scope.farmId, name: "Activity farm A" }]);
    expect(pages.find(page => page.section === "PLOTS")?.items).toEqual([expect.objectContaining({ id: f.a.plot.id, name: "Plot B" })]);
    expect(pages.find(page => page.section === "COST_CATEGORIES")?.items.length).toBeGreaterThan(0);
    expect(pages.find(page => page.section === "ACTIVITIES")?.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(pages)).not.toContain("requestHash");
  });
  it("never returns another account's records, even with a guessed cursor", async () => {
    const pages = await walk(f.b);
    expect(JSON.stringify(pages)).not.toContain(f.a.scope.farmId);
    const forged = encodePullCursor({ snapshotId: id(), issuedAt: new Date().toISOString(), farmIndex: 0, sectionIndex: PULL_SECTIONS.indexOf("PLOTS"), pageCursor: f.a.plot.id, taken: 0 });
    await expect(puller(f.b).pull({ cursor: forged })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("reports an expired cursor so the phone can restart, and rejects junk", async () => {
    const issuedAt = new Date("2026-11-01T00:00:00Z").toISOString();
    const cursor = encodePullCursor({ snapshotId: id(), issuedAt, farmIndex: 0, sectionIndex: 0, pageCursor: null, taken: 0 });
    expect(await puller(f.a, () => new Date("2026-11-03T00:00:00Z")).pull({ cursor })).toEqual({ status: "EXPIRED" });
    await expect(puller(f.a).pull({ cursor: "%%%" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(puller(f.a).pull({ cursor: "x", tenantId: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("stops a section at its row limit", async () => {
    const rows = Array.from({ length: PULL_LIMITS.maxRowsPerSection + 20 }, (_, index) => ({ id: id(), tenantId: f.b.scope.tenantId, farmId: f.b.scope.farmId, name: "Plot " + index, createdBy: f.b.scope.actorId }));
    await f.owner.plot.createMany({ data: rows });
    const pages = await walk(f.b);
    const plots = pages.filter(page => page.section === "PLOTS").flatMap(page => page.items);
    expect(plots).toHaveLength(PULL_LIMITS.maxRowsPerSection);
    await f.owner.plot.deleteMany({ where: { id: { in: rows.map(row => row.id) } } });
  });
  it("gives an account with no farmer profile an empty result, and refuses a signed-out caller", async () => {
    const noProfile = new PullService(f.a.auth, { farms: async () => { const { FoundationError } = await import("@/modules/engineering-foundation/domain/errors"); throw new FoundationError("FORBIDDEN"); }, page: async () => ({ items: [], nextCursor: null }) });
    expect(await noProfile.pull()).toMatchObject({ status: "OK", farms: [], nextCursor: null });
    const signedOut = new PullService({ account: async () => { const { FoundationError } = await import("@/modules/engineering-foundation/domain/errors"); throw new FoundationError("UNAUTHENTICATED"); } }, { farms: async () => [], page: async () => ({ items: [], nextCursor: null }) });
    await expect(signedOut.pull()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("skips a farm whose access ends and finishes cleanly when there are none", async () => {
    await f.owner.farmMember.updateMany({ where: { userId: f.b.scope.actorId }, data: { status: "REVOKED" } });
    try {
      const page = await puller(f.b).pull();
      expect(page).toMatchObject({ status: "OK", farms: [], items: [], nextCursor: null });
    } finally { await f.owner.farmMember.updateMany({ where: { userId: f.b.scope.actorId }, data: { status: "ACTIVE" } }); }
  });
});

describe("MYF-P07-AC003 push outcomes", () => {
  const pusher = (m: Member) => new PushService(m.auth, services(m));
  const outcomeOf = async (m: Member, command: ReturnType<typeof push>) => (await pusher(m).push({ commands: [command] })).results[0];
  it("commits valid commands in order and reports each one", async () => {
    const parent = push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-20" }), expense = push("RECORD_EXPENSE", { categoryId: (await category("COST")).id, amount: "5000", currency: "UGX", occurredOn: "2026-11-01" });
    const { results } = await pusher(f.a).push({ commands: [parent, expense] });
    expect(results.map(row => [row.clientMutationId, row.outcome.status])).toEqual([[parent.clientMutationId, "COMMITTED"], [expense.clientMutationId, "COMMITTED"]]);
    expect(results[0].outcome).toMatchObject({ result: { activityId: expect.any(String), version: 1 } });
  });
  it("a refused command does not stop or undo the others in its batch", async () => {
    const bad = push("RECORD_EXPENSE", { categoryId: id(), amount: "-1", currency: "UGX", occurredOn: "2026-11-01" }), good = push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-21" });
    const { results } = await pusher(f.a).push({ commands: [bad, good] });
    expect(results.map(row => row.outcome.status)).toEqual(["INVALID", "COMMITTED"]);
    expect(await f.owner.auditEvent.count({ where: { requestId: bad.clientMutationId } })).toBe(0);
  });
  it("a malformed command is reported alone and leaves the rest of the queue moving", async () => {
    const good = push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-22" });
    const { results } = await pusher(f.a).push({ commands: [{ clientMutationId: "not-a-uuid", operation: "DELETE_FARM" }, good] });
    expect(results.map(row => row.outcome.status)).toEqual(["INVALID", "COMMITTED"]);
  });
  it("returns a stale edit as a conflict with the current record, and leaves the record alone", async () => {
    const task = await f.a.activities.schedule(f.a.scope.farmId, f.command({ type: "CLEANING", enterpriseId: undefined, plotId: undefined }));
    await f.a.activities.complete(f.a.scope.farmId, task.activityId, { requestId: id(), expectedVersion: 1, workerName: "First device" });
    const { outcome } = await outcomeOf(f.a, push("COMPLETE_ACTIVITY", { activityId: task.activityId, workerName: "Second device" }, { baseVersion: 1 }));
    expect(outcome).toEqual({ status: "CONFLICT", current: { activityId: task.activityId, version: 2, status: "COMPLETED" } });
    expect((await f.a.activities.detail(f.a.scope.farmId, task.activityId)).workerName).toBe("First device");
  });
  it("rejects a reused key with a different payload and keeps the original", async () => {
    const command = push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-23" });
    const first = await outcomeOf(f.a, command);
    expect(first.outcome.status).toBe("COMMITTED");
    expect((await outcomeOf(f.a, { ...command, payload: { type: "CLEANING", dueOn: "2026-11-24" } })).outcome.status).toBe("CONFLICT");
    expect((await outcomeOf(f.a, command)).outcome).toEqual(first.outcome);
  });
  it("denies foreign farms and parents per command", async () => {
    expect((await outcomeOf(f.a, push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-23" }, { farmId: f.b.scope.farmId }))).outcome.status).toBe("DENIED");
    expect((await outcomeOf(f.a, push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-23", plotId: f.b.plot.id }))).outcome.status).toBe("DENIED");
  });
  it("denies a member revoked while offline, keeping nothing", async () => {
    const command = push("CREATE_TASK", { type: "CLEANING", dueOn: "2026-11-25" });
    await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "REVOKED" } });
    try { expect((await outcomeOf(f.a, command)).outcome.status).toBe("DENIED"); }
    finally { await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "ACTIVE" } }); }
    expect(await f.owner.auditEvent.count({ where: { requestId: command.clientMutationId } })).toBe(0);
  });
  it("treats an unexpected failure as retryable, and a signed-out caller as the whole request failing", async () => {
    const failing = new PushService(f.a.auth, { ...services(f.a), scheduleActivity: async () => { throw new Error("database down"); } });
    expect((await failing.push({ commands: [push("CREATE_TASK", {})] })).results[0].outcome).toEqual({ status: "RETRYABLE" });
    const { FoundationError } = await import("@/modules/engineering-foundation/domain/errors");
    await expect(new PushService({ account: async () => { throw new FoundationError("UNAUTHENTICATED"); } }, services(f.a)).push({ commands: [push("CREATE_TASK", {})] })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(pusher(f.a).push({ commands: [] })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
