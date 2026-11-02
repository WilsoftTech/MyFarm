import { describe, expect, it } from "vitest";
import { attachPhotoSchema, checkOfflineCommand, pullPositionSchema, pushCommandSchema, pushRequestSchema } from "@/modules/offline-first/contracts/commands";
import { CATALOG_SECTIONS, OFFLINE_OPERATIONS, OPERATION_LABELS, PULL_LIMITS, PULL_SECTIONS, decodePullCursor, detectPhotoType, encodePullCursor, isPullCursorExpired, newOutboxEntry, nextPullPosition, photoProblem, type PullPosition } from "@/modules/offline-first/domain/commands";
import { OFFLINE_SUPPORT } from "@/modules/offline-first/domain/storage";

const id = () => crypto.randomUUID();
const expense = { categoryId: id(), amount: "150000", currency: "ugx", occurredOn: "2026-11-03" };
const now = new Date("2026-11-03T09:00:00.000Z");

describe("MYF-P07-AC002 offline actions", () => {
  it("covers the source write actions with a label each", () => {
    expect([...OFFLINE_OPERATIONS].sort()).toEqual(["ATTACH_PHOTO", "COMPLETE_ACTIVITY", "CREATE_TASK", "RECORD_ACTIVITY", "RECORD_EXPENSE", "RECORD_HARVEST", "RECORD_INCOME"]);
    expect(Object.keys(OPERATION_LABELS).sort()).toEqual([...OFFLINE_OPERATIONS].sort());
  });
  it("normalizes with the server's own schema and binds the request to the mutation", () => {
    const mutation = id();
    expect(checkOfflineCommand("RECORD_EXPENSE", mutation, expense)).toEqual({ ok: true, payload: expect.objectContaining({ requestId: mutation, amount: "150000", currency: "UGX" }) });
  });
  it("reports field errors before anything is saved", () => {
    const result = checkOfflineCommand("RECORD_EXPENSE", id(), { ...expense, amount: "-1", occurredOn: "2026-02-30" });
    expect(result).toEqual({ ok: false, errors: expect.objectContaining({ amount: expect.any(String), occurredOn: expect.any(String) }) });
  });
  it.each([{ tenantId: id() }, { actorId: id() }, { status: "POSTED" }, { farmId: id() }])("rejects server-owned field %j", field => {
    expect(checkOfflineCommand("RECORD_EXPENSE", id(), { ...expense, ...field }).ok).toBe(false);
  });
  it("validates harvest, income, activity, task and completion the same way", () => {
    expect(checkOfflineCommand("RECORD_INCOME", id(), expense).ok).toBe(true);
    expect(checkOfflineCommand("RECORD_ACTIVITY", id(), { type: "WEEDING", dueOn: "2026-11-03" }).ok).toBe(true);
    expect(checkOfflineCommand("CREATE_TASK", id(), { type: "MOWING", dueOn: "2026-11-04" }).ok).toBe(false);
    expect(checkOfflineCommand("COMPLETE_ACTIVITY", id(), { activityId: id(), workerName: "Okello" }).ok).toBe(true);
    expect(checkOfflineCommand("COMPLETE_ACTIVITY", id(), { activityId: "x" }).ok).toBe(false);
    const harvest = { cropCycleId: id(), cropId: id(), plotId: id(), storageLocationId: id(), harvestDate: "2026-11-03", quantity: "2400", unit: "KG", lossQuantity: "150" };
    expect(checkOfflineCommand("RECORD_HARVEST", id(), harvest).ok).toBe(true);
    expect(checkOfflineCommand("RECORD_HARVEST", id(), { ...harvest, lossQuantity: "2401" }).ok).toBe(false);
  });
  it("builds a pending entry with every source field", () => {
    const entry = newOutboxEntry({ clientMutationId: "m", deviceId: "d", farmId: "f", operation: "RECORD_EXPENSE", payload: { a: 1 } }, now);
    expect(entry).toMatchObject({ clientMutationId: "m", deviceId: "d", createdAt: now.toISOString(), updatedAt: now.toISOString(), syncStatus: "PENDING", version: 1, attemptCount: 0, baseVersion: null, dependsOn: null, result: null });
  });
});

describe("D-P07-004 photos", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  it("detects the type from the bytes", () => {
    expect(detectPhotoType(jpeg)).toBe("image/jpeg");
    expect(detectPhotoType(png)).toBe("image/png");
    expect(detectPhotoType(webp)).toBe("image/webp");
    expect(detectPhotoType(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
    expect(detectPhotoType(new Uint8Array())).toBeNull();
  });
  it("applies the interim limits", () => {
    expect(photoProblem(jpeg, "image/jpeg")).toBeNull();
    expect(photoProblem(new Uint8Array(), "image/jpeg")).toBe("EMPTY");
    expect(photoProblem(Uint8Array.from([1, 2, 3]), "image/jpeg")).toBe("NOT_AN_IMAGE");
    expect(photoProblem(jpeg, "image/png")).toBe("TYPE_MISMATCH");
    const atLimit = new Uint8Array(OFFLINE_SUPPORT.maxPhotoBytes); atLimit.set(jpeg);
    expect(photoProblem(atLimit, "image/jpeg")).toBeNull();
    const over = new Uint8Array(OFFLINE_SUPPORT.maxPhotoBytes + 1); over.set(jpeg);
    expect(photoProblem(over, "image/jpeg")).toBe("TOO_LARGE");
  });
  it("attaches to exactly one record, stored or still local", () => {
    const base = { requestId: id(), photoId: id(), target: "ACTIVITY" };
    expect(attachPhotoSchema.safeParse({ ...base, recordId: id() }).success).toBe(true);
    expect(attachPhotoSchema.safeParse({ ...base, parentMutationId: id() }).success).toBe(true);
    expect(attachPhotoSchema.safeParse(base).success).toBe(false);
    expect(attachPhotoSchema.safeParse({ ...base, recordId: id(), parentMutationId: id() }).success).toBe(false);
  });
});

describe("push contract", () => {
  const command = { clientMutationId: id(), deviceId: id(), farmId: id(), operation: "RECORD_EXPENSE", payload: {}, baseVersion: null, createdAt: now.toISOString() };
  it("bounds a batch and stays strict", () => {
    expect(pushRequestSchema.safeParse({ commands: [command] }).success).toBe(true);
    expect(pushRequestSchema.safeParse({ commands: [] }).success).toBe(false);
    expect(pushRequestSchema.safeParse({ commands: Array(21).fill(command) }).success).toBe(false);
    expect(pushCommandSchema.safeParse({ ...command, actorId: id() }).success).toBe(false);
    expect(pushCommandSchema.safeParse({ ...command, operation: "DELETE_FARM" }).success).toBe(false);
    expect(pushCommandSchema.safeParse({ ...command, clientMutationId: "x" }).success).toBe(false);
  });
});

describe("pull cursor", () => {
  const position: PullPosition = { snapshotId: id(), issuedAt: now.toISOString(), farmIndex: 0, sectionIndex: 0, pageCursor: null, taken: 0 };
  it("round trips in a URL-safe form and fails closed on junk", () => {
    const cursor = encodePullCursor(position);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodePullCursor(cursor)).toEqual(position);
    expect(decodePullCursor("%%%")).toBeNull();
    expect(pullPositionSchema.safeParse(decodePullCursor(cursor)).success).toBe(true);
    expect(pullPositionSchema.safeParse({ ...position, sectionIndex: PULL_SECTIONS.length }).success).toBe(false);
    expect(pullPositionSchema.safeParse({ ...position, tenantId: id() }).success).toBe(false);
  });
  it("expires after a day, and rejects a time in the future or an unreadable one", () => {
    expect(isPullCursorExpired(position, new Date(now.getTime() + PULL_LIMITS.cursorHours * 3_600_000))).toBe(false);
    expect(isPullCursorExpired(position, new Date(now.getTime() + PULL_LIMITS.cursorHours * 3_600_000 + 1))).toBe(true);
    expect(isPullCursorExpired(position, new Date(now.getTime() - 3_600_000))).toBe(true);
    expect(isPullCursorExpired({ ...position, issuedAt: "soon" }, now)).toBe(true);
  });
  it("walks pages, then sections, then farms, and stops", () => {
    const paged = nextPullPosition(position, id(), 50, 2);
    expect(paged).toMatchObject({ sectionIndex: 0, farmIndex: 0, taken: 50 });
    expect(nextPullPosition(position, null, 10, 2)).toMatchObject({ sectionIndex: 1, farmIndex: 0, pageCursor: null, taken: 0 });
    const lastSection = { ...position, sectionIndex: PULL_SECTIONS.length - 1 };
    expect(nextPullPosition(lastSection, null, 10, 2)).toMatchObject({ farmIndex: 1, sectionIndex: 0 });
    expect(nextPullPosition({ ...lastSection, farmIndex: 1 }, null, 10, 2)).toBeNull();
    expect(nextPullPosition(lastSection, null, 0, 1)).toBeNull();
    expect(nextPullPosition(position, null, 0, 0)).toMatchObject({ sectionIndex: 1 });
  });
  it("stops a section at its row limit even when the server has more", () => {
    expect(nextPullPosition({ ...position, taken: PULL_LIMITS.maxRowsPerSection - PULL_LIMITS.pageSize }, id(), PULL_LIMITS.pageSize, 1)).toMatchObject({ sectionIndex: 1, taken: 0 });
  });
  it("marks reference sections separately from records", () => {
    for (const section of CATALOG_SECTIONS) expect(PULL_SECTIONS).toContain(section);
    expect(CATALOG_SECTIONS).not.toContain("ACCOUNTING_RECORDS");
    expect(CATALOG_SECTIONS).not.toContain("ACTIVITIES");
  });
});
