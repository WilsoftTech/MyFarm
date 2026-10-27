import { describe, expect, it } from "vitest";
import { assertAccountingRecord, assertCropCycleLink, recognizedEvents, type AccountingRecordFields, type RecognitionEvent, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { assertReportScope, eventsInScope, grossMargin, moneySummary } from "@/modules/farm-accounting/domain/reporting";
import { signedMoneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import { csvCell, toCsv } from "@/modules/farm-accounting/application/reporting";
import { reportQuerySchema } from "@/modules/farm-accounting/contracts/accounting";
import type { EnterpriseReference } from "@/modules/enterprises-seasons/domain/production";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const forbidden = expect.objectContaining({ code: "FORBIDDEN" });
const maize: EnterpriseReference = { ...scope, enterpriseId: id(), type: "CROP", status: "ACTIVE" };
const layers: EnterpriseReference = { ...scope, enterpriseId: id(), type: "POULTRY", status: "ACTIVE" };
const season2027A = id(), seasonB = id(), plot1 = id(), plot2 = id();
const cycle = { ...scope, cycleId: id(), enterpriseId: maize.enterpriseId, seasonId: season2027A, plotId: plot1 };

describe("crop-cycle link rule (P04-T007, D-P04-007)", () => {
  it.each([[{ seasonId: season2027A }], [{ plotId: plot1 }], [{ seasonId: season2027A, plotId: plot1 }], [{}]])("accepts maize linked to %j when a cycle matches", links => {
    expect(() => assertCropCycleLink(scope, links, maize, [cycle])).not.toThrow();
  });
  it.each([[{ seasonId: seasonB }], [{ plotId: plot2 }], [{ seasonId: season2027A, plotId: plot2 }]])("rejects maize linked to %j when no cycle matches", links => {
    expect(() => assertCropCycleLink(scope, links, maize, [cycle])).toThrow(invalid);
    expect(() => assertCropCycleLink(scope, links, maize, [])).toThrow(invalid);
  });
  it("ignores cycles of another enterprise and refuses cycles from another farm", () => {
    expect(() => assertCropCycleLink(scope, { seasonId: season2027A }, maize, [{ ...cycle, enterpriseId: id() }])).toThrow(invalid);
    expect(() => assertCropCycleLink(scope, { seasonId: season2027A }, maize, [{ ...cycle, farmId: id() }])).toThrow(forbidden);
  });
  it("needs only same-farm links for poultry/other enterprises and records without an enterprise", () => {
    expect(() => assertCropCycleLink(scope, { seasonId: seasonB, plotId: plot2 }, layers, [])).not.toThrow();
    expect(() => assertCropCycleLink(scope, { seasonId: seasonB, plotId: plot2 }, undefined, [])).not.toThrow();
  });
  it("is enforced by assertAccountingRecord with looked-up parents (AC003 oracle shape)", () => {
    const category = { categoryId: id(), kind: "COST" as const, active: true };
    const fields: AccountingRecordFields = { kind: "EXPENSE", categoryId: category.categoryId, amount: "150000", currency: "UGX", occurredOn: "2027-03-10", enterpriseId: maize.enterpriseId, seasonId: season2027A };
    const season = { ...scope, seasonId: season2027A, status: "ACTIVE" as const };
    expect(() => assertAccountingRecord(scope, fields, { category, enterprise: maize, season, cropCycles: [cycle] })).not.toThrow();
    expect(() => assertAccountingRecord(scope, fields, { category, enterprise: maize, season })).toThrow(invalid);
  });
});

const event = (overrides: Partial<RecognitionEvent>): RecognitionEvent => ({ basis: "ACCRUAL", effect: "COST", recordId: id(), kind: "EXPENSE", paymentId: null, amount: "1", currency: "UGX", recognizedOn: "2027-03-10", enterpriseId: null, categoryId: null, categoryName: null, ...overrides });

describe("report scope (P04-T010, D-P04-010)", () => {
  it("filters inclusive calendar dates with open ends and rejects reversed or impossible ranges", () => {
    const events = ["2027-01-01", "2027-03-10", "2027-12-31"].map(recognizedOn => event({ recognizedOn }));
    expect(eventsInScope(events, { basis: "ACCRUAL", from: "2027-03-10", to: "2027-12-31" }).map(e => e.recognizedOn)).toEqual(["2027-03-10", "2027-12-31"]);
    expect(eventsInScope(events, { basis: "ACCRUAL", to: "2027-03-10" })).toHaveLength(2);
    expect(eventsInScope(events, { basis: "ACCRUAL" })).toHaveLength(3);
    for (const bad of [{ from: "2027-02-01", to: "2027-01-31" }, { from: "2027-02-30" }]) expect(() => assertReportScope({ basis: "ACCRUAL", ...bad })).toThrow(invalid);
    expect(() => eventsInScope([event({ basis: "CASH" })], { basis: "ACCRUAL" })).toThrow(invalid);
  });
  it("parses blank form dates as open and defaults to the accrual basis", () => {
    expect(reportQuerySchema.parse({ from: "", to: "" })).toEqual({ basis: "ACCRUAL", from: undefined, to: undefined });
    expect(reportQuerySchema.safeParse({ basis: "CASH", from: "2027-02-01", to: "2027-01-31" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ basis: "NET" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ farmId: id() }).success).toBe(false);
  });
});

describe("gross margin (P04-T010, AC004, D-P04-008)", () => {
  const records: RecognitionRecord[] = [
    { recordId: id(), kind: "SALE", amount: "500000", currency: "UGX", occurredOn: "2027-06-01", status: "POSTED", enterpriseId: maize.enterpriseId },
    { recordId: id(), kind: "EXPENSE", amount: "150000", currency: "UGX", occurredOn: "2027-03-10", status: "POSTED", enterpriseId: maize.enterpriseId },
    { recordId: id(), kind: "EXPENSE", amount: "20000", currency: "UGX", occurredOn: "2027-02-01", status: "POSTED" },
    { recordId: id(), kind: "INCOME", amount: "0.5", currency: "USD", occurredOn: "2027-02-01", status: "POSTED", enterpriseId: layers.enterpriseId },
  ];
  it("computes 500,000 − 150,000 = 350,000 with no AI dependency, and keeps unlinked costs out of the margin", () => {
    const [ugx] = grossMargin(recognizedEvents("ACCRUAL", records, []).filter(e => e.currency === "UGX"));
    expect(ugx).toEqual({ currency: "UGX", enterprises: [{ enterpriseId: maize.enterpriseId, revenue: "500000", directCosts: "150000", grossMargin: "350000" }], farm: { revenue: "500000", directCosts: "150000", grossMargin: "350000" }, unassigned: { revenue: "0", costs: "20000" } });
  });
  it("separates currencies, sorts them and reports negative margins exactly", () => {
    const result = grossMargin(recognizedEvents("ACCRUAL", [...records, { recordId: id(), kind: "PURCHASE", amount: "1.25", currency: "USD", occurredOn: "2027-02-02", status: "POSTED", enterpriseId: layers.enterpriseId }], []));
    expect(result.map(c => c.currency)).toEqual(["UGX", "USD"]);
    expect(result[1].enterprises).toEqual([{ enterpriseId: layers.enterpriseId, revenue: "0.5", directCosts: "1.25", grossMargin: "-0.75" }]);
  });
  it("excludes reversals, rejects duplicate sources and is independent of input order", () => {
    const reversed = records.map((r, n) => n === 0 ? { ...r, status: "REVERSED" as const } : r);
    expect(grossMargin(recognizedEvents("ACCRUAL", reversed, []))[0].farm).toEqual({ revenue: "0", directCosts: "150000", grossMargin: "-150000" });
    expect(() => recognizedEvents("ACCRUAL", [records[0], records[0]], [])).toThrow(invalid);
    expect(grossMargin(recognizedEvents("ACCRUAL", [...records].reverse(), []))).toEqual(grossMargin(recognizedEvents("ACCRUAL", records, [])));
  });
});

describe("money summary (P04-T013, AC005)", () => {
  const fert = id(), feed = id();
  it("answers spent, categories (largest first), revenue and the costliest enterprise", () => {
    const [ugx] = moneySummary([
      event({ amount: "150000", enterpriseId: maize.enterpriseId, categoryId: fert, categoryName: "Fertilizer" }),
      event({ amount: "80000", enterpriseId: layers.enterpriseId, categoryId: feed, categoryName: "Feed" }),
      event({ amount: "20000", categoryId: feed, categoryName: "Feed" }),
      event({ effect: "REVENUE", kind: "SALE", amount: "500000", enterpriseId: maize.enterpriseId }),
    ]);
    expect(ugx).toEqual({ currency: "UGX", spent: "250000", revenue: "500000", unassignedCosts: "20000",
      spending: [{ categoryId: fert, categoryName: "Fertilizer", amount: "150000" }, { categoryId: feed, categoryName: "Feed", amount: "100000" }],
      costliest: { enterpriseIds: [maize.enterpriseId], costs: "150000" } });
  });
  it("shows all tied enterprises and no costliest enterprise when nothing is linked", () => {
    const [tied] = moneySummary([event({ amount: "5", enterpriseId: maize.enterpriseId }), event({ amount: "5", enterpriseId: layers.enterpriseId })]);
    expect(tied.costliest).toEqual({ enterpriseIds: [maize.enterpriseId, layers.enterpriseId].sort(), costs: "5" });
    const [none] = moneySummary([event({ amount: "5" })]);
    expect(none.costliest).toEqual({ enterpriseIds: [], costs: "0" });
    expect(none.spending).toEqual([{ categoryId: null, categoryName: "Uncategorised", amount: "5" }]);
    expect(moneySummary([])).toEqual([]);
  });
});

describe("signed money and CSV safety (P04-T013/T014)", () => {
  it("formats negative results without floating point", () => {
    expect(signedMoneyString(moneyUnits("0.1") - moneyUnits("0.3"))).toBe("-0.2");
    expect(signedMoneyString(0n)).toBe("0");
  });
  it.each([["=SUM(A1)", "'=SUM(A1)"], ["+1", "'+1"], ["@x", "'@x"], ["-x", "'-x"], ["-50000", "-50000"], ["-0.75", "-0.75"], ["a,b", "\"a,b\""], ["say \"hi\"", "\"say \"\"hi\"\"\""], ["line\nbreak", "\"line\nbreak\""], ["Maize", "Maize"]])("escapes %j as %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });
  it("joins rows with CRLF and a trailing newline", () => {
    expect(toCsv([["a", "b"], [], ["c"]])).toBe("a,b\r\n\r\nc\r\n");
  });
});
