import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InsightFeedView } from "@/components/intelligence/insight-feed";
import { changeText, valueText } from "@/components/intelligence/labels";
import { evaluateBatchTrends } from "@/modules/farm-intelligence/domain/batch-trends";
import { evidenceOf, type InsightFeed, type InsightView } from "@/modules/farm-intelligence/contracts/insights";

const day = (from: string, index: number) => new Date(Date.parse(from + "T00:00:00Z") + index * 86_400_000).toISOString().slice(0, 10);
const evaluation = evaluateBatchTrends({
  batchId: "b0000000-0000-4000-8000-000000000001", label: "Layers A", status: "ACTIVE", startingQuantity: 500, acquiredOn: "2026-08-01",
  entries: [
    ...Array.from({ length: 28 }, (_, i) => ({ type: "EGGS" as const, quantity: "400", unit: "EGG", occurredOn: day("2026-09-16", i) })),
    ...Array.from({ length: 28 }, (_, i) => ({ type: "EGGS" as const, quantity: i < 13 ? "349" : "348", unit: "EGG", occurredOn: day("2026-10-14", i) })),
    { type: "MORTALITY", quantity: "5", unit: "BIRD", occurredOn: "2026-10-13" }, { type: "MORTALITY", quantity: "12", unit: "BIRD", occurredOn: "2026-11-10" },
  ],
  feedCosts: [{ amount: "500000", currency: "UGX", occurredOn: "2026-09-20" }, { amount: "613800", currency: "UGX", occurredOn: "2026-10-20" }],
}, "2026-11-11")!;
const insight = (index: number, overrides: Partial<InsightView> = {}): InsightView => {
  const candidate = evaluation.candidates[index];
  return { insightId: crypto.randomUUID(), batchId: candidate.batchId, ruleKey: candidate.ruleKey, ruleVersion: 1, severity: candidate.severity, status: "OPEN", currency: candidate.currency,
    evaluatedOn: "2026-11-11", evidence: evidenceOf(evaluation, candidate), acknowledgedAt: null, version: 1, ...overrides };
};
const feed = (overrides: Partial<InsightFeed>): InsightFeed => ({ evaluatedOn: "2026-11-11", insights: [], notJudged: [], batchesChecked: 1, batchesTruncated: false, ...overrides });
const acknowledge = () => vi.fn(async () => undefined);

describe("insight feed (MYF-P10-AC001)", () => {
  it("shows each alert's level, values, periods, coverage and rule version in plain words", () => {
    render(<InsightFeedView feed={feed({ insights: [insight(0), insight(1, { status: "ACKNOWLEDGED", acknowledgedAt: "2026-11-11T08:00:00.000Z", version: 2 })] })} acknowledge={acknowledge} />);
    const warning = within(screen.getByRole("article", { name: "Fewer eggs while feed costs more" }));
    expect(warning.getByText("Warning")).toBeTruthy();
    expect(warning.getByText("Change: +24%")).toBeTruthy();
    expect(warning.getByText("Change: -12%")).toBeTruthy();
    expect(warning.getByText(/Last 4 weeks: 2026-10-14 to 2026-11-10\. Compared with 2026-09-16 to 2026-10-13\./)).toBeTruthy();
    expect(warning.getByText(/Birds at the start: 500, then 495\./)).toBeTruthy();
    expect(warning.getByText(/\(version 1\)/)).toBeTruthy();
    expect(warning.getByRole("button", { name: "I have seen this" })).toBeTruthy();
    const watch = within(screen.getByRole("article", { name: "More birds are dying than before" }));
    expect(watch.getByText("Watch")).toBeTruthy();
    expect(watch.getByText("Change: +1.4 points")).toBeTruthy();
    expect(watch.getByText(/You marked this as seen on 2026-11-11/)).toBeTruthy();
    expect(watch.queryByRole("button")).toBeNull();
  });
  it("tells an empty farm from a farm with nothing to report, and lists what could not be judged", () => {
    const { unmount } = render(<InsightFeedView feed={feed({ batchesChecked: 0 })} acknowledge={acknowledge} />);
    expect(screen.getByText(/No active poultry batch to check/)).toBeTruthy();
    unmount();
    render(<InsightFeedView feed={feed({ notJudged: [{ batchId: "b", batchLabel: "Young layers", rule: "EGGS_FALLING", currency: null, missing: ["FEW_EGG_DAYS", "NO_EARLIER_EGGS"] }] })} acknowledge={acknowledge} />);
    expect(screen.getByText(/^No alerts\./)).toBeTruthy();
    expect(screen.getByText("Young layers: Eggs per 100 birds a day")).toBeTruthy();
    expect(screen.getByText("No eggs were recorded in the earlier 4 weeks.")).toBeTruthy();
  });
  it("signs rises, keeps falls and zero as they are, and names the unit", () => {
    expect([changeText("FEED_COST_RISING", "24"), changeText("EGGS_FALLING", "-12"), changeText("MORTALITY_RISING", "0"), changeText("MORTALITY_RISING", "1.4")]).toEqual(["+24%", "-12%", "0 points", "+1.4 points"]);
    expect([valueText("FEED_COST_RISING", "1240", "UGX"), valueText("MORTALITY_RISING", "2.4", null), valueText("EGGS_FALLING", "70.4", null)]).toEqual(["1240 UGX", "2.4%", "70.4"]);
  });
});
