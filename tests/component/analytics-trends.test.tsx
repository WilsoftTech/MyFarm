import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FarmTrends } from "@/components/analytics/trends";
import type { TrendsView } from "@/modules/analytics-profitability/contracts/profitability";
import type { MetricValue, UnavailableReason } from "@/modules/analytics-profitability/domain/metric";
import type { BatchTrend, CropTrend } from "@/modules/analytics-profitability/domain/trends";

const id = () => crypto.randomUUID();
const value = (text: string): MetricValue => ({ status: "AVAILABLE", value: text });
const none = (reason: UnavailableReason): MetricValue => ({ status: "UNAVAILABLE", reason });
const view = (overrides: Partial<TrendsView>): TrendsView => ({ basis: "ACCRUAL", season: null, from: null, to: null, asOf: "2027-12-31T09:00:00.000Z", cropsNeedSeason: false, crops: [], batches: [], ...overrides });
const feed = { categoryId: id(), name: "Feed", earlier: value("100000"), current: value("118000"), change: value("+18") };
const crop: CropTrend = {
  cropId: id(), cropName: "Maize", season: { seasonId: id(), label: "2027A" }, earlierSeason: { seasonId: id(), label: "2026B" }, unavailable: null, soFar: false,
  yieldPerAcre: { earlier: value("2000"), current: value("3000"), change: value("+50") },
  currencies: [{ currency: "UGX", figures: [{ figure: "COSTS", earlier: value("100000"), current: value("118000"), change: value("+18") }, { figure: "COST_PER_KG", earlier: value("50"), current: none("NO_HARVEST"), change: none("NO_HARVEST") }], categories: [{ ...feed, name: "Fertilizer" }], notLinked: { current: "0", earlier: "0" } }],
};
const batch: BatchTrend = {
  batchId: id(), label: "Batch 2", animalTypeName: "Chicken", earlierBatch: { batchId: id(), label: "Batch 1" }, unavailable: null, soFar: true,
  currencies: [{ currency: "UGX", figures: [{ figure: "COST_PER_BIRD", earlier: value("1000"), current: value("1180"), change: value("+18") }], categories: [feed, { ...feed, categoryId: id(), name: "Veterinary", earlier: value("0"), current: value("5000"), change: none("NO_BASELINE") }], notLinked: { current: "900", earlier: "0" } }],
};
const line = (scope: HTMLElement, label: string) => within(scope).getByText(label, { selector: "dt" }).nextElementSibling?.textContent;

describe("trends on the farm screen (P08-T009, MYF-P08-AC003)", () => {
  it("shows a crop against its earlier season, with the +18% change", () => {
    render(<FarmTrends view={view({ crops: [crop] })} />);
    const card = screen.getByRole("list", { name: "Crop trends" });
    expect(within(card).getByText("2027A compared with 2026B")).toBeTruthy();
    expect(line(card, "Fertilizer")).toBe("UGX 100,000 →then UGX 118,000Change: +18%");
    expect(line(card, "Yield per acre")).toBe("2,000 kg →then 3,000 kgChange: +50%");
    expect(line(card, "Cost per kg")).toContain("Not available: no harvest to count yet.");
  });
  it("shows a batch against the previous one, says when there is no baseline, and warns about unlinked costs", () => {
    render(<FarmTrends view={view({ batches: [batch] })} />);
    const card = screen.getByRole("list", { name: "Batch trends" });
    expect(within(card).getByText("Chicken, compared with Batch 1")).toBeTruthy();
    expect(within(card).getByText("So far: one side is still open, so figures can still change.")).toBeTruthy();
    expect(line(card, "Feed")).toContain("Change: +18%");
    expect(line(card, "Veterinary")).toContain("Change: Not available: nothing earlier to compare with.");
    expect(within(card).getByText(/not linked to a batch: UGX 900 now and UGX 0 before\. The comparison may mislead\./)).toBeTruthy();
  });
  it("says why there is nothing to compare instead of showing figures", () => {
    render(<FarmTrends view={view({ crops: [{ ...crop, earlierSeason: null, unavailable: "NO_EARLIER_SEASON", yieldPerAcre: null, currencies: [] }], batches: [{ ...batch, earlierBatch: null, unavailable: "NO_EARLIER_BATCH", currencies: [] }] })} />);
    expect(screen.getByText("Not available: no earlier season grew this crop.")).toBeTruthy();
    expect(screen.getByText("Not available: no earlier batch of these birds.")).toBeTruthy();
    expect(screen.queryByText(/Change:/)).toBeNull();
  });
  it("asks for a season before comparing crops, and says when there is nothing to show", () => {
    const { unmount } = render(<FarmTrends view={view({ cropsNeedSeason: true })} />);
    expect(screen.getByText("Choose a season above to compare its crops with an earlier season.")).toBeTruthy();
    expect(screen.getByText("No poultry batches on this farm.")).toBeTruthy();
    unmount();
    render(<FarmTrends view={view({})} />);
    expect(screen.getByText("No crops in this season.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Compared with before" })).toBeTruthy();
  });
});
