import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfficerDashboard } from "@/components/officers/dashboard";
import type { DashboardView } from "@/modules/extension-officers/contracts/service";
const view: DashboardView = { officerAccountId: "officer", nextCursor: null, farms: [], dashboard: {
  asOf: "2026-11-21T10:00:00Z", today: "2026-11-21", coverage: "COMPLETE", counts: { myFarmers: 0, visitsToday: 0, followUps: 0, problems: 0 },
} };
describe("Assigned officer dashboard", () => {
  it("shows a real empty state, checked time and current-access reload", () => {
    render(<OfficerDashboard view={view} scope="scope" />);
    expect(screen.getByText(/No farms are currently assigned/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reload assigned work" })).toHaveAttribute("href", "/agent?scope=scope");
    expect(screen.getByText(/Connect and reload/)).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(4);
  });
  it("does not render partial totals as zero", () => {
    render(<OfficerDashboard view={{ ...view, dashboard: { ...view.dashboard, coverage: "PARTIAL", counts: null } }} scope="scope" />);
    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
    expect(screen.getByText(/Totals are unavailable/)).toHaveAttribute("role", "status");
  });
  it("paginates farm labels separately from card totals", () => {
    render(<OfficerDashboard view={{ ...view, nextCursor: "next", farms: [{ assignmentId: "grant", farmId: "farm", farmerId: "farmer", tenantId: "tenant", name: "Home farm", district: "Rukungiri", version: 1, permissions: ["DASHBOARD"] }] }} scope="scope" />);
    expect(screen.getByRole("heading", { name: "Home farm" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "More assigned farms" })).toHaveAttribute("href", "/agent?scope=scope&cursor=next");
  });
});
