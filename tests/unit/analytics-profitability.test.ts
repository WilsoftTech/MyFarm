import { describe, expect, it } from "vitest";
import { recognizedEvents, type RecognitionBasis, type RecognitionPayment, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { grossMargin } from "@/modules/farm-accounting/domain/reporting";
import { dashboardQuerySchema } from "@/modules/analytics-profitability/contracts/profitability";
import { percentString } from "@/modules/analytics-profitability/domain/metric";
import { farmDashboard, latestActiveSeason, seasonEvents, type EnterpriseName } from "@/modules/analytics-profitability/domain/profitability";

const id = () => crypto.randomUUID();
const maize = id(), poultry = id(), bananas = id(), seasonA = id(), seasonB = id();
const names: EnterpriseName[] = [{ enterpriseId: maize, name: "Maize" }, { enterpriseId: poultry, name: "Poultry" }, { enterpriseId: bananas, name: "Bananas" }];
const record = (kind: RecognitionRecord["kind"], amount: string, links: Partial<RecognitionRecord> = {}): RecognitionRecord => ({ recordId: id(), kind, amount, currency: "UGX", occurredOn: "2027-03-01", status: "POSTED", ...links });
const events = (records: RecognitionRecord[], basis: RecognitionBasis = "ACCRUAL", payments: RecognitionPayment[] = []) => recognizedEvents(basis, records, payments);
/** The source dashboard, P0494-P0513. */
const source = (seasonId?: string) => [
  record("SALE", "3800000", { enterpriseId: maize, seasonId }), record("EXPENSE", "2100000", { enterpriseId: maize, seasonId }),
  record("SALE", "3200000", { enterpriseId: poultry, seasonId }), record("PURCHASE", "2400000", { enterpriseId: poultry, seasonId }),
  record("INCOME", "1400000", { enterpriseId: bananas, seasonId }), record("EXPENSE", "650000", { enterpriseId: bananas, seasonId }),
];

describe("percentages (D-P08-007)", () => {
  it.each([[3250000n, 8400000n, "38.7"], [18000n, 100000n, "18"], [1n, 3n, "33.3"], [2n, 3n, "66.7"], [1n, 8n, "12.5"], [1n, 16n, "6.3"], [-11n, 200n, "-5.5"], [-1n, 16n, "-6.3"], [-1n, 100000n, "0"], [0n, 5n, "0"], [3n, 1n, "300"]])("%s of %s is %s%%", (numerator, denominator, expected) => {
    expect(percentString(numerator, denominator)).toBe(expected);
  });
  it("refuses a denominator that is not positive, so no caller can show a made-up figure", () => {
    expect(() => percentString(1n, 0n)).toThrow(RangeError);
    expect(() => percentString(1n, -2n)).toThrow(RangeError);
  });
  it("stays exact beyond the range of a binary number", () => {
    expect(percentString(9_007_199_254_740_993n * 10_000n, 9_007_199_254_740_993n * 30_000n)).toBe("33.3");
  });
});

describe("farm dashboard (MYF-P08-AC001)", () => {
  it("reproduces the source dashboard exactly", () => {
    const [ugx, ...others] = farmDashboard(events(source()), names);
    expect(others).toEqual([]);
    expect(ugx).toMatchObject({ currency: "UGX", revenue: "8400000", expenses: "5150000", recordedSurplus: "3250000", surplusMargin: { status: "AVAILABLE", value: "38.7" } });
    expect(ugx.enterprises.map(row => [row.name, row.revenue, row.directCosts, row.grossMargin])).toEqual([
      ["Maize", "3800000", "2100000", "1700000"], ["Poultry", "3200000", "2400000", "800000"], ["Bananas", "1400000", "650000", "750000"],
    ]);
    expect(ugx.topEnterpriseIds).toEqual([maize]);
  });
  it("enterprise totals plus unlinked amounts always equal the farm totals, and agree with the gross margin report", () => {
    const rows = events([...source(), record("EXPENSE", "400000.25"), record("INCOME", "100000.5")]);
    const [ugx] = farmDashboard(rows, names);
    expect(ugx.allEnterprises).toEqual({ revenue: "8400000", directCosts: "5150000", grossMargin: "3250000" });
    expect(ugx.unassigned).toEqual({ revenue: "100000.5", costs: "400000.25" });
    expect(ugx).toMatchObject({ revenue: "8500000.5", expenses: "5550000.25", recordedSurplus: "2950000.25" });
    expect(ugx.allEnterprises).toEqual(grossMargin(rows)[0].farm);
  });
  it("deducts shared costs from the surplus without moving them into any enterprise (D-P08-002)", () => {
    const [before] = farmDashboard(events(source()), names), [after] = farmDashboard(events([...source(), record("EXPENSE", "500000")]), names);
    expect(after.recordedSurplus).toBe("2750000");
    expect(after.enterprises).toEqual(before.enterprises);
  });
  it("gives each enterprise its own margin, and says when it cannot be calculated", () => {
    const [ugx] = farmDashboard(events([record("SALE", "200", { enterpriseId: maize }), record("EXPENSE", "211", { enterpriseId: maize }), record("EXPENSE", "50", { enterpriseId: poultry })]), names);
    expect(ugx.enterprises.map(row => [row.name, row.grossMargin, row.marginPercent])).toEqual([
      ["Maize", "-11", { status: "AVAILABLE", value: "-5.5" }], ["Poultry", "-50", { status: "UNAVAILABLE", reason: "NO_REVENUE" }],
    ]);
    expect(ugx.surplusMargin).toEqual({ status: "AVAILABLE", value: "-30.5" });
  });
  it("shows costs with no revenue as a loss with no margin, never as 0%", () => {
    const [ugx] = farmDashboard(events([record("EXPENSE", "75000")]), names);
    expect(ugx).toMatchObject({ revenue: "0", expenses: "75000", recordedSurplus: "-75000", surplusMargin: { status: "UNAVAILABLE", reason: "NO_REVENUE" } });
    expect(ugx.enterprises).toEqual([]);
    expect(ugx.topEnterpriseIds).toEqual([]);
  });
  it("revenue exactly equal to costs is a real 0% margin", () => {
    expect(farmDashboard(events([record("SALE", "100"), record("EXPENSE", "100")]), names)[0]).toMatchObject({ recordedSurplus: "0", surplusMargin: { status: "AVAILABLE", value: "0" } });
  });
  it("orders tied enterprises by name and reports all of them as top", () => {
    const [ugx] = farmDashboard(events([record("SALE", "500", { enterpriseId: poultry }), record("SALE", "500", { enterpriseId: bananas }), record("SALE", "100", { enterpriseId: maize })]), names);
    expect(ugx.enterprises.map(row => row.name)).toEqual(["Bananas", "Poultry", "Maize"]);
    expect(ugx.topEnterpriseIds).toEqual([bananas, poultry].sort());
  });
  it("returns nothing for a farm with no records, so the screen can say so instead of showing zeros", () => {
    expect(farmDashboard([], names)).toEqual([]);
  });
  it("reversed records leave the figures, as corrections require", () => {
    const rows = source();
    rows[1] = { ...rows[1], status: "REVERSED" };
    expect(farmDashboard(events(rows), names)[0]).toMatchObject({ expenses: "3050000", recordedSurplus: "5350000" });
  });
  it("keeps currencies apart and never adds them together", () => {
    const rows = farmDashboard(events([record("SALE", "100", { currency: "USD", enterpriseId: maize }), record("SALE", "500", { enterpriseId: maize })]), names);
    expect(rows.map(row => [row.currency, row.revenue])).toEqual([["UGX", "500"], ["USD", "100"]]);
  });
  it("the cash view counts only money that moved, on the same dashboard rules", () => {
    const sale = record("SALE", "1000", { enterpriseId: maize });
    const payment: RecognitionPayment = { paymentId: id(), direction: "RECEIVED", paidOn: "2027-03-05", status: "POSTED", allocations: [{ obligationId: sale.recordId, amount: "400" }] };
    expect(farmDashboard(events([sale], "ACCRUAL"), names)[0].revenue).toBe("1000");
    expect(farmDashboard(events([sale], "CASH", [payment]), names)[0]).toMatchObject({ revenue: "400", expenses: "0", recordedSurplus: "400" });
  });
  it("still shows an enterprise whose name is unknown rather than dropping its money", () => {
    const [ugx] = farmDashboard(events([record("SALE", "5", { enterpriseId: maize })]), []);
    expect(ugx.enterprises).toEqual([expect.objectContaining({ enterpriseId: maize, name: "" })]);
  });
});

describe("season scope (D-P08-008)", () => {
  it("counts only records linked to the season and reports what has no season", () => {
    const rows = events([...source(seasonA), record("EXPENSE", "111", { seasonId: seasonB }), record("EXPENSE", "70"), record("INCOME", "30"), record("INCOME", "9", { currency: "USD" })]);
    const scoped = seasonEvents(rows, seasonA);
    expect(farmDashboard(scoped.events, names)[0]).toMatchObject({ revenue: "8400000", expenses: "5150000", recordedSurplus: "3250000" });
    expect(scoped.notLinkedToSeason).toEqual([{ currency: "UGX", revenue: "30", costs: "70" }, { currency: "USD", revenue: "9", costs: "0" }]);
  });
  it("does not use dates, so a record dated inside a season but linked elsewhere stays out", () => {
    const rows = events([record("SALE", "1", { seasonId: seasonB, occurredOn: "2027-01-01" }), record("SALE", "2", { occurredOn: "2027-01-01" })]);
    expect(seasonEvents(rows, seasonA)).toEqual({ events: [], notLinkedToSeason: [{ currency: "UGX", revenue: "2", costs: "0" }] });
  });
  it("carries a sale's season to the cash events its payments create", () => {
    const sale = record("SALE", "1000", { seasonId: seasonA });
    const payment: RecognitionPayment = { paymentId: id(), direction: "RECEIVED", paidOn: "2027-09-05", status: "POSTED", allocations: [{ obligationId: sale.recordId, amount: "400" }] };
    expect(seasonEvents(events([sale], "CASH", [payment]), seasonA).events.map(event => event.amount)).toEqual(["400"]);
  });
  it("defaults to the active season that started most recently", () => {
    const old = { seasonId: id(), status: "ACTIVE" as const, startDate: "2027-01-01" }, recent = { seasonId: id(), status: "ACTIVE" as const, startDate: "2027-03-01" }, closed = { seasonId: id(), status: "CLOSED" as const, startDate: "2027-06-01" };
    expect(latestActiveSeason([old, recent, closed])).toBe(recent);
    expect(latestActiveSeason([closed])).toBeNull();
    expect(latestActiveSeason([])).toBeNull();
  });
  it("breaks a start-date tie the same way every time", () => {
    const [a, b] = [id(), id()].sort().map(seasonId => ({ seasonId, status: "ACTIVE" as const, startDate: "2027-03-01" }));
    expect(latestActiveSeason([b, a])).toBe(a);
  });
});

describe("dashboard filters", () => {
  const season = id();
  it("defaults to accrual and accepts one season or a date range", () => {
    expect(dashboardQuerySchema.parse({})).toEqual({ basis: "ACCRUAL" });
    expect(dashboardQuerySchema.parse({ basis: "CASH", seasonId: season })).toEqual({ basis: "CASH", seasonId: season });
    expect(dashboardQuerySchema.parse({ from: "2027-01-01", to: "2027-12-31", seasonId: "" })).toEqual({ basis: "ACCRUAL", from: "2027-01-01", to: "2027-12-31" });
  });
  it.each([
    [{ seasonId: season, from: "2027-01-01" }], [{ seasonId: "not-an-id" }], [{ from: "2027-02-30" }], [{ from: "2027-03-01", to: "2027-02-01" }], [{ basis: "PROFIT" }],
    [{ farmId: id() }], [{ tenantId: id() }], [{ actorId: id() }],
  ])("refuses %j", input => {
    expect(dashboardQuerySchema.safeParse(input).success).toBe(false);
  });
});
