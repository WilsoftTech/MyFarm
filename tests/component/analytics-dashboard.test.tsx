import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FarmDashboard } from "@/components/analytics/dashboard";
import type { DashboardView } from "@/modules/analytics-profitability/contracts/profitability";
import { recognizedEvents, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { farmDashboard } from "@/modules/analytics-profitability/domain/profitability";

const id = () => crypto.randomUUID();
const maize = id(), poultry = id();
const season = { seasonId: id(), label: "2027A", status: "ACTIVE" as const, startDate: "2027-03-01", endDate: null };
const record = (kind: RecognitionRecord["kind"], amount: string, enterpriseId?: string): RecognitionRecord => ({ recordId: id(), kind, amount, currency: "UGX", occurredOn: "2027-03-01", status: "POSTED", enterpriseId });
const currencies = (records: RecognitionRecord[]) => farmDashboard(recognizedEvents("ACCRUAL", records, []), [{ enterpriseId: maize, name: "Maize" }, { enterpriseId: poultry, name: "Poultry" }]);
const view = (overrides: Partial<DashboardView>): DashboardView => ({ basis: "ACCRUAL", season, from: null, to: null, asOf: "2027-12-31T09:00:00.000Z", currencies: [], notLinkedToSeason: [], seasons: [season], ...overrides });
const show = (overrides: Partial<DashboardView>) => render(<FarmDashboard view={view(overrides)} moneyPath="/farms/x/accounting" />);
const figure = (label: string) => screen.getAllByText(label).map(node => node.nextElementSibling?.textContent);

describe("farm dashboard screen (P08-T003)", () => {
  it("shows the figures with money formatted and the source's margin", () => {
    show({ currencies: currencies([record("SALE", "8400000"), record("EXPENSE", "5150000")]) });
    expect(figure("Money earned")).toEqual(["UGX 8,400,000"]);
    expect(figure("Money spent")).toEqual(["UGX 5,150,000"]);
    expect(figure("Recorded surplus")).toEqual(["UGX 3,250,000"]);
    expect(figure("Margin")).toEqual(["38.7%"]);
  });
  it("never uses a profit label for any figure", () => {
    show({ currencies: currencies([record("SALE", "100", maize)]) });
    expect(screen.queryByText(/profit/i)).toBeNull();
  });
  it("compares enterprises in order and marks the highest in words, not only by position", () => {
    show({ currencies: currencies([record("SALE", "100", poultry), record("SALE", "500", maize), record("EXPENSE", "50", maize)]) });
    const rows = within(screen.getByRole("list", { name: "Enterprises in UGX" })).getAllByRole("listitem");
    expect(rows.map(row => within(row).getByRole("heading").textContent)).toEqual(["MaizeHighest", "Poultry"]);
    expect(within(rows[0]).getByText("Gross margin").nextElementSibling?.textContent).toBe("UGX 450");
    expect(within(rows[0]).getByText("Margin").nextElementSibling?.textContent).toBe("90%");
  });
  it("says why a margin is missing instead of showing 0%", () => {
    show({ currencies: currencies([record("EXPENSE", "75000", maize)]) });
    expect(figure("Recorded surplus")).toEqual(["UGX -75,000"]);
    expect(screen.getAllByText("Not available: no money earned yet.").length).toBe(2);
    expect(screen.queryByText("0%")).toBeNull();
  });
  it("shows shared costs as counted but not shared out", () => {
    show({ currencies: currencies([record("SALE", "100", maize), record("EXPENSE", "30")]) });
    expect(screen.getByText(/Not linked to an enterprise: money earned UGX 0, money spent UGX 30\./)).toBeTruthy();
    expect(figure("Recorded surplus")).toEqual(["UGX 70"]);
  });
  it("names records left out of a season", () => {
    show({ currencies: currencies([record("SALE", "100", maize)]), notLinkedToSeason: [{ currency: "UGX", revenue: "5", costs: "300000" }] });
    expect(within(screen.getByRole("region", { name: "Not linked to a season" })).getByText("Money earned UGX 5, money spent UGX 300,000")).toBeTruthy();
  });
  it("keeps each currency in its own section", () => {
    show({ currencies: currencies([record("SALE", "100"), { ...record("SALE", "7"), currency: "USD" }]) });
    expect(screen.getByRole("heading", { name: "Amounts in UGX" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Amounts in USD" })).toBeTruthy();
    expect(figure("Money earned")).toEqual(["UGX 100", "USD 7"]);
  });
  it("an empty season explains itself, and shows no zeros", () => {
    show({});
    expect(screen.getByRole("heading", { name: "No money records in this view" })).toBeTruthy();
    expect(screen.getByText(/No money record is linked to 2027A yet/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to money records" }).getAttribute("href")).toBe("/farms/x/accounting");
    expect(screen.queryByText("Recorded surplus")).toBeNull();
  });
  it("an empty farm with no season asks for its first record", () => {
    show({ season: null });
    expect(screen.getByText("Figures appear here once you record money on this farm.")).toBeTruthy();
  });
  it("shows an enterprise with an unknown name rather than dropping its money", () => {
    const records = [record("SALE", "9", id())];
    show({ currencies: currencies(records) });
    expect(screen.getByRole("heading", { name: "EnterpriseHighest" })).toBeTruthy();
  });
});
