import { describe, expect, it } from "vitest";
import { recognizedEvents, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { costGroupTotals, cropMetrics, type CostGroup, type CropCycleFacts } from "@/modules/analytics-profitability/domain/metrics";
import { farmDashboard } from "@/modules/analytics-profitability/domain/profitability";
import { reconcile } from "@/modules/analytics-profitability/domain/reconcile";

const id = () => crypto.randomUUID();
const maize = id(), bananas = id(), poultry = id(), fertilizer = id(), feed = id(), rent = id(), labour = id();
const names = [{ enterpriseId: maize, name: "Maize" }, { enterpriseId: bananas, name: "Bananas" }, { enterpriseId: poultry, name: "Poultry" }];
const groups = new Map<string, CostGroup>([[fertilizer, "INPUT"], [feed, "INPUT"], [labour, "LABOUR"]]);
const record = (kind: RecognitionRecord["kind"], amount: string, links: Partial<RecognitionRecord> = {}): RecognitionRecord => ({ recordId: id(), kind, amount, currency: "UGX", occurredOn: "2027-03-01", status: "POSTED", ...links });
/** The source dashboard (P0494-P0513): 8,400,000 earned and 5,150,000 spent, plus a shared rent with no enterprise. */
const source = [
  record("SALE", "3800000", { enterpriseId: maize }), record("EXPENSE", "2100000", { enterpriseId: maize, categoryId: fertilizer }),
  record("SALE", "3200000", { enterpriseId: poultry }), record("PURCHASE", "2400000", { enterpriseId: poultry, categoryId: feed }),
  record("INCOME", "1400000", { enterpriseId: bananas }), record("EXPENSE", "650000", { enterpriseId: bananas, categoryId: fertilizer }),
  record("EXPENSE", "300000", { categoryId: rent }), record("EXPENSE", "0.0001", { enterpriseId: maize, categoryId: labour }),
];
const cycle = (enterpriseId: string): CropCycleFacts => ({ cycleId: id(), enterpriseId, cropId: id(), cropName: "Crop", areaPlanted: "1", areaUnit: "ACRE", status: "CLOSED", harvestedKg: "10", lostKg: "0" });
function figures(records: RecognitionRecord[]) {
  const events = recognizedEvents("ACCRUAL", records, []);
  return { currencies: farmDashboard(events, names), costGroups: costGroupTotals(events, groups), crops: cropMetrics([cycle(maize), cycle(bananas)], events, "ALL_RECORDS") };
}

describe("reconciliation (MYF-P08-R004, L gate: metrics reconcile)", () => {
  it("the source dashboard, its cost groups and its crop lines all add up", () => {
    const { currencies, costGroups, crops } = figures(source);
    expect(currencies[0]).toMatchObject({ revenue: "8400000", expenses: "5450000.0001", recordedSurplus: "2949999.9999" });
    expect(reconcile(currencies, costGroups, crops)).toEqual({ reconciled: true, checked: 8, failures: [] });
  });
  it("keeps currencies apart and checks each", () => {
    const { currencies, costGroups, crops } = figures([...source, record("EXPENSE", "12.5", { enterpriseId: maize, currency: "USD", categoryId: feed }), record("SALE", "40", { enterpriseId: maize, currency: "USD" })]);
    expect(currencies.map(row => row.currency)).toEqual(["UGX", "USD"]);
    expect(reconcile(currencies, costGroups, crops)).toMatchObject({ reconciled: true, checked: 14 });
  });
  it("an empty farm has nothing to disagree about", () => {
    expect(reconcile([], [], [])).toEqual({ reconciled: true, checked: 0, failures: [] });
  });
  it("names each figure that does not add up, with what it should be", () => {
    const { currencies, costGroups, crops } = figures(source), [ugx] = currencies;
    const wrongSurplus = [{ ...ugx, recordedSurplus: "3250000" }];
    expect(reconcile(wrongSurplus, costGroups, crops).failures).toEqual([{ check: "SURPLUS", currency: "UGX", expected: "2949999.9999", found: "3250000" }]);
    const lostLine = [{ ...ugx, enterprises: ugx.enterprises.filter(line => line.enterpriseId !== bananas) }];
    expect(reconcile(lostLine, costGroups, []).failures.map(row => row.check)).toEqual(["REVENUE_ADDS_UP", "COSTS_ADD_UP"]);
    expect(reconcile(currencies, [{ ...costGroups[0], other: "0" }], crops).failures).toEqual([{ check: "COST_GROUPS_ADD_UP", currency: "UGX", expected: "5450000.0001", found: "5150000.0001" }]);
    const crop = crops.find(line => line.enterpriseId === maize)!;
    expect(reconcile(currencies, costGroups, [{ ...crop, currencies: [{ ...crop.currencies[0], costs: "1" }] }]).failures).toEqual([{ check: "CROP_MONEY_MATCHES", currency: "UGX", expected: "2100000.0001", found: "1", enterpriseId: maize }]);
  });
  it("money in a currency the dashboard lost, or a crop line it does not show, is a failure", () => {
    const { currencies, costGroups } = figures(source);
    expect(reconcile(currencies, [...costGroups, { currency: "USD", labour: "0", inputs: "5", other: "0" }], []).failures).toEqual([{ check: "COST_GROUPS_ADD_UP", currency: "USD", expected: "0", found: "5" }]);
    expect(reconcile(currencies, costGroups, [{ enterpriseId: id(), currencies: [{ currency: "UGX", costs: "0", revenue: "7", costPerAcre: { status: "AVAILABLE", value: "0" }, revenuePerAcre: { status: "AVAILABLE", value: "7" }, costPerKg: { status: "AVAILABLE", value: "0" } }] }]).failures).toMatchObject([{ check: "CROP_MONEY_MATCHES", expected: "0", found: "7" }]);
  });
  it("a loss reconciles with its sign, and a malformed figure is refused rather than read as 0", () => {
    const { currencies, costGroups } = figures([record("EXPENSE", "10", { categoryId: rent })]);
    expect(currencies[0].recordedSurplus).toBe("-10");
    expect(reconcile(currencies, costGroups, []).reconciled).toBe(true);
    expect(() => reconcile([{ ...currencies[0], revenue: "1e3" }], costGroups, [])).toThrow();
  });
});
