import { describe, expect, it } from "vitest";
import { changeRecurrenceSchema, createRecurrenceSchema, stopRecurrenceSchema } from "@/modules/farm-activities/contracts/recurrence";
import { MAX_DATES_PER_EXPANSION, RECURRENCE_HORIZON_DAYS, RECURRING_ACTIVITY_TYPES, addDays, assertNotInPast, assertRecurringType, expansionPlan, occurrenceDates, type RecurrenceRule } from "@/modules/farm-activities/domain/recurrence";

const rule = (overrides: Partial<RecurrenceRule> = {}): RecurrenceRule => ({ frequency: "DAILY", interval: 1, startOn: "2026-11-02", endOn: null, stoppedFrom: null, ...overrides });
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });

describe("MYF-P06-R003 recurring activity types", () => {
  it("keeps the source list", () => {
    expect([...RECURRING_ACTIVITY_TYPES].sort()).toEqual(["CLEANING", "FEEDING", "INSPECTION", "MILKING", "VACCINATION"]);
  });
  it("refuses activities the source does not list as recurring", () => {
    for (const type of RECURRING_ACTIVITY_TYPES) expect(() => assertRecurringType(type)).not.toThrow();
    expect(() => assertRecurringType("WEEDING")).toThrowError(invalid);
  });
});

describe("MYF-P06-AC003 occurrence dates", () => {
  it("repeats daily, every N days and weekly", () => {
    expect(occurrenceDates(rule(), "2026-11-02", "2026-11-04")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(occurrenceDates(rule({ interval: 3 }), "2026-11-02", "2026-11-09")).toEqual(["2026-11-02", "2026-11-05", "2026-11-08"]);
    expect(occurrenceDates(rule({ frequency: "WEEKLY" }), "2026-11-02", "2026-11-16")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(occurrenceDates(rule({ frequency: "WEEKLY", interval: 2 }), "2026-11-02", "2026-11-30")).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
  });
  it("clamps monthly dates to short months without drifting", () => {
    expect(occurrenceDates(rule({ frequency: "MONTHLY", startOn: "2027-01-31" }), "2027-01-01", "2027-05-31")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
  });
  it("uses 29 February in a leap year and repeats every N months across a year", () => {
    expect(occurrenceDates(rule({ frequency: "MONTHLY", startOn: "2028-01-31" }), "2028-02-01", "2028-02-29")).toEqual(["2028-02-29"]);
    expect(occurrenceDates(rule({ frequency: "MONTHLY", interval: 5, startOn: "2026-11-15" }), "2026-11-01", "2027-12-31")).toEqual(["2026-11-15", "2027-04-15", "2027-09-15"]);
  });
  it("crosses month and year boundaries on a weekly series", () => {
    expect(occurrenceDates(rule({ frequency: "WEEKLY", startOn: "2026-12-28" }), "2026-12-28", "2027-01-11")).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]);
  });
  it("stops on the end date inclusively", () => {
    expect(occurrenceDates(rule({ endOn: "2026-11-03" }), "2026-11-02", "2026-11-10")).toEqual(["2026-11-02", "2026-11-03"]);
  });
  it("creates nothing on or after a stop date", () => {
    expect(occurrenceDates(rule({ stoppedFrom: "2026-11-04" }), "2026-11-02", "2026-11-10")).toEqual(["2026-11-02", "2026-11-03"]);
    expect(occurrenceDates(rule({ stoppedFrom: "2026-11-02" }), "2026-11-02", "2026-11-10")).toEqual([]);
  });
  it("gives the same dates from a window far from the start date", () => {
    for (const overrides of [{ interval: 3 }, { frequency: "WEEKLY" as const, interval: 2 }, { frequency: "MONTHLY" as const, startOn: "2024-01-31" }, { frequency: "MONTHLY" as const, interval: 7, startOn: "2024-03-31" }]) {
      const all = occurrenceDates(rule(overrides), "2024-01-01", "2030-12-31", 100_000);
      expect(occurrenceDates(rule(overrides), "2029-03-10", "2029-09-20")).toEqual(all.filter(date => date >= "2029-03-10" && date <= "2029-09-20"));
    }
  });
  it("never starts before the series starts", () => {
    expect(occurrenceDates(rule({ startOn: "2026-11-10" }), "2026-11-01", "2026-11-11")).toEqual(["2026-11-10", "2026-11-11"]);
  });
});

describe("MYF-P06-AC003 expansion plan", () => {
  it("generates to the horizon and marks the series generated that far", () => {
    const plan = expansionPlan(rule(), null, "2026-11-02");
    expect(plan.dates).toHaveLength(RECURRENCE_HORIZON_DAYS + 1);
    expect(plan.expandedThrough).toBe(addDays("2026-11-02", RECURRENCE_HORIZON_DAYS));
  });
  it("adds nothing when repeated on the same day and only new dates on a later day", () => {
    const first = expansionPlan(rule(), null, "2026-11-02");
    expect(expansionPlan(rule(), first.expandedThrough, "2026-11-02").dates).toEqual([]);
    expect(expansionPlan(rule(), first.expandedThrough, "2026-11-04").dates).toEqual([addDays(first.expandedThrough, 1), addDays(first.expandedThrough, 2)]);
  });
  it("catches up a long-unopened series in bounded steps without gaps or repeats", () => {
    const seen: string[] = [];
    let through: string | null = null, calls = 0;
    do {
      const plan: ReturnType<typeof expansionPlan> = expansionPlan(rule({ startOn: "2024-01-01" }), through, "2026-11-02");
      expect(plan.dates.length).toBeLessThanOrEqual(MAX_DATES_PER_EXPANSION);
      seen.push(...plan.dates);
      if (plan.dates.length === 0) break;
      through = plan.expandedThrough;
    } while (++calls < 10);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toEqual(occurrenceDates(rule({ startOn: "2024-01-01" }), "2024-01-01", addDays("2026-11-02", RECURRENCE_HORIZON_DAYS), 100_000));
  });
});

describe("recurrence commands", () => {
  const requestId = crypto.randomUUID();
  const create = { requestId, type: "FEEDING", frequency: "DAILY", interval: 1, startOn: "2026-11-02" };
  it("accepts a valid series and treats blanks as absent", () => {
    expect(createRecurrenceSchema.parse({ ...create, endOn: "", workerName: " ", enterpriseId: "" })).toMatchObject({ endOn: undefined, workerName: undefined, enterpriseId: undefined });
  });
  it.each([{ interval: 0 }, { interval: 366 }, { interval: 1.5 }, { frequency: "YEARLY" }, { startOn: "2026-02-30" }, { endOn: "2026-11-01" }, { tenantId: requestId }, { timeZone: "UTC" }])("rejects %j", overrides => {
    expect(createRecurrenceSchema.safeParse({ ...create, ...overrides }).success).toBe(false);
  });
  it("requires the change date to precede its end date", () => {
    const change = { requestId, expectedVersion: 1, frequency: "WEEKLY", interval: 1, effectiveFrom: "2026-11-10" };
    expect(changeRecurrenceSchema.safeParse(change).success).toBe(true);
    expect(changeRecurrenceSchema.safeParse({ ...change, endOn: "2026-11-09" }).success).toBe(false);
  });
  it("requires explicit confirmation to stop", () => {
    expect(stopRecurrenceSchema.safeParse({ requestId, expectedVersion: 1, stopFrom: "2026-11-10", confirmed: true }).success).toBe(true);
    expect(stopRecurrenceSchema.safeParse({ requestId, expectedVersion: 1, stopFrom: "2026-11-10" }).success).toBe(false);
  });
  it("refuses dates already past", () => {
    expect(() => assertNotInPast("2026-11-02", "2026-11-02")).not.toThrow();
    expect(() => assertNotInPast("2026-11-01", "2026-11-02")).toThrowError(invalid);
  });
});
