import { describe, expect, it } from "vitest";
import { localSaveFailureLabels, storageSnapshotSchema, storageWarningLabels } from "@/modules/offline-first/contracts/storage";
import { OFFLINE_STORES, OFFLINE_SUPPORT, STORAGE_WARNINGS, classifyLocalSaveError, offlineDatabaseName, serviceWorkerPolicy, storageHealth, type StorageSnapshot } from "@/modules/offline-first/domain/storage";

const now = new Date("2026-11-20T09:00:00Z");
const healthy: StorageSnapshot = { persisted: true, usageBytes: 10_000_000, quotaBytes: 500_000_000, unsentEntries: 0, lastSyncAt: "2026-11-20T08:00:00.000Z", firstUnsentAt: null };
const warningsFor = (overrides: Partial<StorageSnapshot>) => storageHealth({ ...healthy, ...overrides }, now).warnings;

describe("D-P07-002 support limits", () => {
  it("records the approved limits", () => {
    expect(OFFLINE_SUPPORT).toMatchObject({ days: 14, maxUnsentEntries: 500, maxPhotoBytes: 2 * 1024 * 1024 });
    expect(Object.isFrozen(OFFLINE_SUPPORT)).toBe(true);
    expect(OFFLINE_SUPPORT.warnAtUnsentEntries).toBeLessThan(OFFLINE_SUPPORT.maxUnsentEntries);
    expect(OFFLINE_SUPPORT.warnAfterDays).toBeLessThan(OFFLINE_SUPPORT.days);
  });
});

describe("MYF-P07-AC001 storage health", () => {
  it("reports no warnings when storage is durable and nothing is waiting", () => {
    expect(storageHealth(healthy, now)).toEqual({ canSave: true, warnings: [], unsentEntries: 0, lastSyncAt: healthy.lastSyncAt, daysSinceSync: 0 });
  });
  it("warns on denied or unknown persistence but still allows saving", () => {
    for (const persisted of [false, null]) {
      const health = storageHealth({ ...healthy, persisted }, now);
      expect(health.warnings).toEqual(["NOT_PERSISTENT"]);
      expect(health.canSave).toBe(true);
    }
  });
  it("warns when free space is low or cannot be read", () => {
    expect(warningsFor({ usageBytes: 500_000_000 - OFFLINE_SUPPORT.lowStorageBytes + 1 })).toEqual(["STORAGE_LOW"]);
    expect(warningsFor({ usageBytes: 500_000_000 - OFFLINE_SUPPORT.lowStorageBytes })).toEqual([]);
    expect(warningsFor({ usageBytes: null })).toEqual(["STORAGE_UNKNOWN"]);
    expect(warningsFor({ quotaBytes: null })).toEqual(["STORAGE_UNKNOWN"]);
  });
  it("warns at 400 unsent entries and refuses new saves at 500", () => {
    expect(storageHealth({ ...healthy, unsentEntries: 399 }, now).warnings).toEqual([]);
    expect(storageHealth({ ...healthy, unsentEntries: 400 }, now).warnings).toEqual(["QUEUE_NEAR_LIMIT"]);
    expect(storageHealth({ ...healthy, unsentEntries: 499 }, now).canSave).toBe(true);
    const full = storageHealth({ ...healthy, unsentEntries: 500 }, now);
    expect(full.canSave).toBe(false);
    expect(full.warnings).toEqual(["QUEUE_FULL"]);
  });
  it("counts waiting time from the oldest unsent entry, at the 10 and 14 day boundaries", () => {
    const waiting = (firstUnsentAt: string) => warningsFor({ unsentEntries: 1, firstUnsentAt });
    expect(waiting("2026-11-10T09:00:01.000Z")).toEqual([]);
    expect(waiting("2026-11-10T09:00:00.000Z")).toEqual(["SYNC_OVERDUE"]);
    expect(waiting("2026-11-06T09:00:01.000Z")).toEqual(["SYNC_OVERDUE"]);
    expect(waiting("2026-11-06T09:00:00.000Z")).toEqual(["BEYOND_SUPPORT"]);
  });
  it("does not warn about an old last sync when nothing is waiting, and handles a phone that never synced", () => {
    expect(warningsFor({ lastSyncAt: "2026-01-01T00:00:00.000Z" })).toEqual([]);
    expect(storageHealth({ ...healthy, lastSyncAt: null }, now).daysSinceSync).toBeNull();
  });
});

describe("MYF-P07-AC001 failed local saves", () => {
  it("recognizes a full phone, including when Dexie wraps the browser error", () => {
    expect(classifyLocalSaveError(new DOMException("full", "QuotaExceededError"))).toBe("QUOTA_EXCEEDED");
    expect(classifyLocalSaveError({ name: "AbortError", inner: { name: "QuotaExceededError" } })).toBe("QUOTA_EXCEEDED");
  });
  it.each(["SecurityError", "InvalidStateError", "MissingAPIError", "OpenFailedError"])("treats %s as storage being unavailable", name => {
    expect(classifyLocalSaveError({ name })).toBe("STORAGE_UNAVAILABLE");
  });
  it.each([new Error("boom"), "text", null, undefined, 7, { name: 7 }])("never treats unknown failure %j as a save", error => {
    expect(classifyLocalSaveError(error)).toBe("SAVE_FAILED");
  });
  it("tells the farmer nothing was saved and their details are kept, for every failure", () => {
    for (const label of Object.values(localSaveFailureLabels)) expect(label).toMatch(/^Not saved: .*Your details are still here/);
    expect(Object.keys(storageWarningLabels).sort()).toEqual([...STORAGE_WARNINGS].sort());
  });
});

describe("D-P07-003 account separation", () => {
  const account = "11111111-1111-4111-8111-111111111111";
  it("gives each account its own database", () => {
    expect(offlineDatabaseName(account)).toBe("myfarm-offline-" + account);
    expect(offlineDatabaseName("22222222-2222-4222-8222-222222222222")).not.toBe(offlineDatabaseName(account));
  });
  it.each(["", "not-a-uuid", "../other", account + "x", "AAAAAAAA-1111-4111-8111-111111111111"])("refuses unsafe account id %j", value => {
    expect(() => offlineDatabaseName(value)).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
  it("keeps unsent work apart from what sign-out clears", () => {
    expect(OFFLINE_STORES.cached).not.toContain("outbox");
    expect(OFFLINE_STORES.cached).not.toContain("photos");
    expect([...OFFLINE_STORES.unsent].sort()).toEqual(["outbox", "photos"]);
  });
});

describe("MYF-P07-AC001 service worker rules", () => {
  const get = (pathname: string, navigation = false) => serviceWorkerPolicy({ method: "GET", sameOrigin: true, pathname, navigation });
  it("caches only built assets and opens the offline shell", () => {
    expect(get("/_next/static/chunks/app.js")).toBe("STATIC_CACHE");
    expect(get("/manifest.webmanifest")).toBe("STATIC_CACHE");
    expect(get("/icon.svg")).toBe("STATIC_CACHE");
    expect(get("/offline", true)).toBe("OFFLINE_SHELL");
  });
  it.each(["/farms/1/accounting", "/workspace", "/sign-in", "/"])("never stores signed-in page %s and falls back to the shell", pathname => {
    expect(get(pathname, true)).toBe("NETWORK_THEN_SHELL");
  });
  it.each(["/api/v1/farms", "/api/v1/sync/push", "/api/health"])("leaves API route %s to the network", pathname => {
    expect(get(pathname)).toBe("NETWORK_ONLY");
    expect(get(pathname, true)).toBe("NETWORK_ONLY");
  });
  it("leaves writes, other origins and other data requests to the network", () => {
    expect(serviceWorkerPolicy({ method: "POST", sameOrigin: true, pathname: "/farms/1", navigation: true })).toBe("NETWORK_ONLY");
    expect(serviceWorkerPolicy({ method: "GET", sameOrigin: false, pathname: "/_next/static/x.js", navigation: false })).toBe("NETWORK_ONLY");
    expect(get("/farms/1/accounting")).toBe("NETWORK_ONLY");
  });
});

describe("storage snapshot contract", () => {
  it("accepts a valid report and browsers that report nothing", () => {
    expect(storageSnapshotSchema.safeParse(healthy).success).toBe(true);
    expect(storageSnapshotSchema.safeParse({ persisted: null, usageBytes: null, quotaBytes: null, unsentEntries: 0, lastSyncAt: null, firstUnsentAt: null }).success).toBe(true);
  });
  it.each([{ unsentEntries: -1 }, { unsentEntries: 1.5 }, { usageBytes: -1 }, { lastSyncAt: "yesterday" }, { accountId: "x" }])("rejects %j", overrides => {
    expect(storageSnapshotSchema.safeParse({ ...healthy, ...overrides }).success).toBe(false);
  });
});
