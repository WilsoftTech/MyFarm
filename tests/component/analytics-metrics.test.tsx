import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FarmMetrics } from "@/components/analytics/metrics";
import type { MetricsView } from "@/modules/analytics-profitability/contracts/profitability";
import { UNAVAILABLE_REASONS, type MetricValue } from "@/modules/analytics-profitability/domain/metric";
import { MetricText } from "@/components/analytics/dashboard";

const id = () => crypto.randomUUID();
const value = (text: string): MetricValue => ({ status: "AVAILABLE", value: text });
const none = (reason: "NO_HARVEST" | "NO_BIRDS" | "NEVER_SOLD" | "MORE_THAN_ONE_CROP"): MetricValue => ({ status: "UNAVAILABLE", reason });
const view = (overrides: Partial<MetricsView>): MetricsView => ({ basis: "ACCRUAL", season: null, from: null, to: null, asOf: "2027-12-31T09:00:00.000Z", crops: [], batches: [], costGroups: [], stock: { items: [], totals: [] }, ...overrides });
const crop = { enterpriseId: id(), enterpriseName: "Maize", crops: ["Maize"], soFar: true, acres: value("3"), harvestedKg: "4000", keptKg: "3750", yieldPerAcre: value("1333.33"), currencies: [{ currency: "UGX", costs: "2100000", revenue: "0", costPerAcre: value("700000"), revenuePerAcre: value("0"), costPerKg: value("560") }] };
const batch = { batchId: id(), label: "Batch 1", enterpriseId: id(), animalTypeName: "Chicken", soFar: false, birdsStarted: "105", deaths: "3", mortalityRate: value("2.9"), currencies: [{ currency: "UGX", costs: "525000", revenue: "0", costPerBird: value("5000"), revenuePerBird: value("0"), enterpriseCostsNotLinked: "0" }] };
const stockLine = { itemId: id(), name: "Maize", unit: "KG", quantity: "3650", pricePerUnit: value("1200"), estimate: value("4380000"), currency: "UGX", soldOn: "2027-08-01" };
const figure = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling?.textContent;

describe("farm metrics screen (P08-T006)", () => {
  it("shows the approved crop example", () => {
    render(<FarmMetrics view={view({ crops: [crop] })} />);
    const card = screen.getByRole("list", { name: "Crop figures" });
    expect(within(card).getByText("Maize · 3 acres")).toBeTruthy();
    expect(within(card).getByText("So far: figures can still change.")).toBeTruthy();
    expect(figure(card, "Yield per acre")).toBe("1,333.33 kg");
    expect(figure(card, "Cost per acre (UGX)")).toBe("UGX 700,000");
    expect(figure(card, "Cost per kg, the price to break even (UGX)")).toBe("UGX 560");
  });
  it("shows the approved bird example, and warns about unlinked costs only when there are some", () => {
    const { unmount } = render(<FarmMetrics view={view({ batches: [batch] })} />);
    const card = screen.getByRole("list", { name: "Batch figures" });
    expect(figure(card, "Birds started")).toBe("105");
    expect(figure(card, "Mortality rate")).toBe("2.9%");
    expect(figure(card, "Cost per bird (UGX)")).toBe("UGX 5,000");
    expect(screen.queryByText(/not linked to a batch/)).toBeNull();
    unmount();
    render(<FarmMetrics view={view({ batches: [{ ...batch, currencies: [{ ...batch.currencies[0], enterpriseCostsNotLinked: "40000" }] }] })} />);
    expect(screen.getByText(/UGX 40,000 of this enterprise's costs are not linked to a batch, so cost per bird may be too low\./)).toBeTruthy();
  });
  it("says why a figure is missing instead of showing 0", () => {
    render(<FarmMetrics view={view({
      crops: [{ ...crop, yieldPerAcre: none("MORE_THAN_ONE_CROP"), currencies: [{ ...crop.currencies[0], costPerKg: none("NO_HARVEST") }] }],
      batches: [{ ...batch, mortalityRate: none("NO_BIRDS") }],
      stock: { items: [{ ...stockLine, pricePerUnit: none("NEVER_SOLD"), estimate: none("NEVER_SOLD"), currency: null, soldOn: null }], totals: [] },
    })} />);
    expect(figure(screen.getByRole("list", { name: "Crop figures" }), "Yield per acre")).toBe("Not available: this enterprise has more than one crop.");
    expect(figure(screen.getByRole("list", { name: "Crop figures" }), "Cost per kg, the price to break even (UGX)")).toBe("Not available: no harvest to count yet.");
    expect(figure(screen.getByRole("list", { name: "Batch figures" }), "Mortality rate")).toBe("Not available: no birds recorded in this batch.");
    expect(within(screen.getByRole("list", { name: "Stock value" })).getByText("Not available: not sold yet.")).toBeTruthy();
    expect(screen.queryByText(/Estimated total/)).toBeNull();
  });
  it("labels stock value as an estimate kept out of the surplus, with the sale date", () => {
    render(<FarmMetrics view={view({ stock: { items: [stockLine], totals: [{ currency: "UGX", estimate: "4380000" }] } })} />);
    expect(screen.getByRole("heading", { name: "Stock value (estimate)" })).toBeTruthy();
    expect(screen.getByText(/it is not counted in your recorded surplus/)).toBeTruthy();
    const card = screen.getByRole("list", { name: "Stock value" });
    expect(figure(card, "Estimated value")).toBe("UGX 4,380,000");
    expect(figure(card, "Last sale price per kg")).toBe("UGX 1,200");
    expect(figure(card, "Last sold")).toBe("2027-08-01");
    expect(screen.getByText("Estimated total: UGX 4,380,000")).toBeTruthy();
  });
  it("shows the labour and input groups with what inputs means", () => {
    render(<FarmMetrics view={view({ costGroups: [{ currency: "UGX", labour: "7000", inputs: "50", other: "3" }] })} />);
    const card = screen.getByRole("list", { name: "Costs by group" });
    expect(figure(card, "Labour cost")).toBe("UGX 7,000");
    expect(figure(card, "Input cost")).toBe("UGX 50");
    expect(figure(card, "Other costs")).toBe("UGX 3");
    expect(screen.getByText(/Inputs are seeds, feed, fertilizer/)).toBeTruthy();
  });
  it("each empty section says so, with no zero figures", () => {
    render(<FarmMetrics view={view({})} />);
    for (const text of ["No crops in this view.", "No poultry batches on this farm.", "No costs in this view.", "No stock on this farm."]) expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText(/UGX/)).toBeNull();
  });
  it("uses singular and plural units, and never uses a profit label", () => {
    render(<FarmMetrics view={view({ crops: [{ ...crop, acres: value("1") }], stock: { items: [{ ...stockLine, unit: "BIRD", quantity: "12" }], totals: [] } })} />);
    expect(screen.getByText("Maize · 1 acre")).toBeTruthy();
    expect(screen.getByText("12 birds in stock")).toBeTruthy();
    expect(screen.getByText("Last sale price per bird")).toBeTruthy();
    expect(screen.queryByText(/profit/i)).toBeNull();
  });
  it.each(UNAVAILABLE_REASONS)("has plain words for %s", reason => {
    render(<MetricText metric={{ status: "UNAVAILABLE", reason }} format={text => text} />);
    expect(screen.getByText(/^Not available/)).toBeTruthy();
  });
});
