import { describe, expect, it } from "vitest";
import { activityPageSchema, cancelActivitySchema, completeActivitySchema } from "@/modules/farm-activities/contracts/activity";
import { ACTIVITY_BUCKETS, activityState, adjacentMonth, assertActivityOpen, assertLinkableCost, farmToday, isCalendarMonth, monthRange } from "@/modules/farm-activities/domain/activity";

const conflict = expect.objectContaining({ code: "CONFLICT" });
const scope = { tenantId: "tenant", farmId: "farm" };

describe("MYF-P06-AC002 farm date", () => {
  it.each([
    ["2026-11-02T20:59:59.999Z", "2026-11-02"],
    ["2026-11-02T21:00:00.000Z", "2026-11-03"],
    ["2026-12-31T21:00:00.000Z", "2027-01-01"],
    ["2028-02-28T21:00:00.000Z", "2028-02-29"],
  ])("reads %s as %s in Africa/Kampala", (now, today) => {
    expect(farmToday(new Date(now))).toBe(today);
  });
});

describe("MYF-P06-AC002 activity state", () => {
  it("shows Plot B fertilizer due tomorrow as upcoming", () => {
    expect(activityState("SCHEDULED", "2026-11-03", "2026-11-02")).toBe("UPCOMING");
  });
  it("derives today and missed from the due date", () => {
    expect(activityState("SCHEDULED", "2026-11-02", "2026-11-02")).toBe("TODAY");
    expect(activityState("SCHEDULED", "2026-11-01", "2026-11-02")).toBe("MISSED");
  });
  it("becomes missed only after the Kampala due date has passed", () => {
    expect(activityState("SCHEDULED", "2026-11-02", farmToday(new Date("2026-11-02T20:59:59Z")))).toBe("TODAY");
    expect(activityState("SCHEDULED", "2026-11-02", farmToday(new Date("2026-11-02T21:00:00Z")))).toBe("MISSED");
  });
  it("compares across month and year boundaries", () => {
    expect(activityState("SCHEDULED", "2026-12-31", "2027-01-01")).toBe("MISSED");
    expect(activityState("SCHEDULED", "2027-01-01", "2026-12-31")).toBe("UPCOMING");
  });
  it("keeps finished records finished whatever their due date", () => {
    for (const dueOn of ["2026-11-01", "2026-11-02", "2026-11-03"]) {
      expect(activityState("COMPLETED", dueOn, "2026-11-02")).toBe("COMPLETED");
      expect(activityState("CANCELLED", dueOn, "2026-11-02")).toBe("CANCELLED");
    }
  });
  it("offers every state the source lists", () => {
    expect([...ACTIVITY_BUCKETS].sort()).toEqual(["CANCELLED", "COMPLETED", "MISSED", "TODAY", "UPCOMING"]);
  });
});

describe("activity lifecycle", () => {
  it("allows a scheduled activity at the expected version, including one that is missed", () => {
    expect(() => assertActivityOpen({ status: "SCHEDULED", version: 1 }, 1)).not.toThrow();
  });
  it("conflicts on a stale version or a finished record", () => {
    expect(() => assertActivityOpen({ status: "SCHEDULED", version: 2 }, 1)).toThrowError(conflict);
    expect(() => assertActivityOpen({ status: "COMPLETED", version: 2 }, 2)).toThrowError(conflict);
    expect(() => assertActivityOpen({ status: "CANCELLED", version: 2 }, 2)).toThrowError(conflict);
  });
});

describe("D-P06-005 cost link", () => {
  it.each(["EXPENSE", "PURCHASE"])("links a posted %s on the same farm", kind => {
    expect(() => assertLinkableCost(scope, { ...scope, kind, status: "POSTED" })).not.toThrow();
  });
  it.each(["INCOME", "SALE", "PAYMENT"])("refuses %s, which is not a cost", kind => {
    expect(() => assertLinkableCost(scope, { ...scope, kind, status: "POSTED" })).toThrowError(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
  it("refuses a reversed record", () => {
    expect(() => assertLinkableCost(scope, { ...scope, kind: "EXPENSE", status: "REVERSED" })).toThrowError(conflict);
  });
  it("refuses another farm or tenant", () => {
    const forbidden = expect.objectContaining({ code: "FORBIDDEN" });
    expect(() => assertLinkableCost(scope, { tenantId: "tenant", farmId: "other", kind: "EXPENSE", status: "POSTED" })).toThrowError(forbidden);
    expect(() => assertLinkableCost(scope, { tenantId: "other", farmId: "farm", kind: "EXPENSE", status: "POSTED" })).toThrowError(forbidden);
  });
});

describe("activity command contracts", () => {
  const base = { requestId: crypto.randomUUID(), expectedVersion: 1 };
  it("trims details and treats blanks as absent", () => {
    expect(completeActivitySchema.parse({ ...base, workerName: "  Okello  ", notes: " ", costRecordId: "" })).toEqual({ ...base, workerName: "Okello", notes: undefined, costRecordId: undefined });
  });
  it.each([{ completedBy: crypto.randomUUID() }, { completedAt: "2026-11-02T00:00:00Z" }, { tenantId: crypto.randomUUID() }, { workerUserId: crypto.randomUUID() }])("rejects server-owned field %j", field => {
    expect(completeActivitySchema.safeParse({ ...base, ...field }).success).toBe(false);
  });
  it("enforces worker, note and version bounds", () => {
    expect(completeActivitySchema.safeParse({ ...base, workerName: "x".repeat(120) }).success).toBe(true);
    expect(completeActivitySchema.safeParse({ ...base, workerName: "x".repeat(121) }).success).toBe(false);
    expect(completeActivitySchema.safeParse({ ...base, notes: "x".repeat(1001) }).success).toBe(false);
    expect(completeActivitySchema.safeParse({ ...base, expectedVersion: 0 }).success).toBe(false);
    expect(completeActivitySchema.safeParse({ ...base, costRecordId: "not-a-uuid" }).success).toBe(false);
  });
  it("requires explicit confirmation to cancel", () => {
    expect(cancelActivitySchema.safeParse({ ...base, confirmed: true }).success).toBe(true);
    expect(cancelActivitySchema.safeParse({ ...base, confirmed: false }).success).toBe(false);
    expect(cancelActivitySchema.safeParse(base).success).toBe(false);
  });
  it("accepts source buckets only and stays strict", () => {
    for (const bucket of ACTIVITY_BUCKETS) expect(activityPageSchema.parse({ bucket }).bucket).toBe(bucket);
    expect(activityPageSchema.safeParse({ bucket: "OVERDUE" }).success).toBe(false);
    expect(activityPageSchema.safeParse({ tenantId: crypto.randomUUID() }).success).toBe(false);
  });
});

describe("calendar months", () => {
  it.each(["2026-11", "1900-01", "2028-02"])("accepts %s", month => expect(isCalendarMonth(month)).toBe(true));
  it.each(["2026-13", "2026-00", "2026-1", "26-11", "2026-11-01", "1899-12", ""])("rejects %s", month => expect(isCalendarMonth(month)).toBe(false));
  it("gives the first and last day, including leap February", () => {
    expect(monthRange("2026-11")).toEqual({ first: "2026-11-01", last: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ first: "2028-02-01", last: "2028-02-29" });
    expect(monthRange("2027-02").last).toBe("2027-02-28");
  });
  it("steps across year boundaries", () => {
    expect(adjacentMonth("2026-12", 1)).toBe("2027-01");
    expect(adjacentMonth("2027-01", -1)).toBe("2026-12");
  });
});
