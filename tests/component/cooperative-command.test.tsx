import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandForm } from "@/components/cooperatives/command-form";
import { CooperativeReport } from "@/components/cooperatives/report";
import type { CooperativeView } from "@/modules/cooperatives/contracts/cooperative";
const navigation = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); navigation.refresh.mockClear(); navigation.push.mockClear(); Object.defineProperty(navigator, "onLine", { configurable: true, value: true }); });
describe("organization review and uncertain-save recovery", () => {
  it("reviews before sending, preserves entered fields and reuses the exact request on retry", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("network lost")).mockResolvedValueOnce(new Response(JSON.stringify({ targetId: crypto.randomUUID(), version: 1 }), { status: 200 }));
    const user = userEvent.setup();
    render(<CommandForm actorId="test-actor" title="Record payment" endpoint="/api/v1/cooperatives/test/operations" fixed={{ type: "PAYMENT", lotId: crypto.randomUUID(), currency: "UGX" }} fields={[{ name: "amount", label: "Amount paid" }]} />);
    await user.type(screen.getByLabelText("Amount paid"), "12.3456");
    await user.click(screen.getByRole("button", { name: "Review details" }));
    expect(fetcher).not.toHaveBeenCalled(); expect(screen.getByRole("heading", { name: "Confirm this exact review" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect(await screen.findByText(/Connection interrupted/)).toBeVisible();
    expect(screen.getByLabelText("Amount paid")).toHaveValue("12.3456");
    await user.click(screen.getByRole("button", { name: "Confirm and save" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledOnce());
    expect(fetcher.mock.calls[0][1]?.body).toBe(fetcher.mock.calls[1][1]?.body);
    const submitted = JSON.parse(String(fetcher.mock.calls[0][1]?.body)); expect(submitted).toMatchObject({ amount: "12.3456", confirmed: true });
  });
  it("shows the exact rounded procurement total and retains a refused review", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "FORBIDDEN" }), { status: 403 }));
    const user = userEvent.setup();
    render(<CommandForm actorId="test-actor" title="Accepted produce" endpoint="/test" fixed={{ type: "PROCURE", unit: "KG", currency: "UGX", quantity: "0.1", unitPrice: "0.3" }} />);
    await user.click(screen.getByRole("button", { name: "Review details" }));
    expect(screen.getByText("Total: UGX 0.03")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect(await screen.findByText(/Your access has changed/)).toBeVisible();
    expect(navigation.refresh).not.toHaveBeenCalled(); expect(screen.getByRole("button", { name: "Change details" })).toBeVisible();
  });
  it("reports offline input as unsaved and disables confirmation", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<CommandForm actorId="test-actor" title="Share" endpoint="/test" fixed={{ type: "SHARE" }} />);
    expect(await screen.findByText(/Unreviewed details are not saved on this device/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Review details" })).toBeDisabled();
  });
  it("changing an unsubmitted review sends only the newly reviewed details", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const user = userEvent.setup();
    render(<CommandForm actorId="test-actor" title="Invite" endpoint="/test" fixed={{ type: "INVITE" }} fields={[{ name: "userId", label: "Account" }]} />);
    await user.type(screen.getByLabelText("Account"), "first"); await user.click(screen.getByRole("button", { name: "Review details" }));
    await user.click(screen.getByRole("button", { name: "Change details" })); await user.clear(screen.getByLabelText("Account")); await user.type(screen.getByLabelText("Account"), "second");
    await user.click(screen.getByRole("button", { name: "Review details" })); await user.click(screen.getByRole("button", { name: "Confirm and save" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledOnce()); expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).userId).toBe("second");
  });
  it("recovers a submitted review through remount and keeps another account's review hidden", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("lost response"));
    const props = { actorId: "actor-a", title: "Create", endpoint: "/api/v1/cooperatives", fields: [{ name: "name", label: "Organization name" }] };
    const first = render(<CommandForm {...props} />);
    await user.type(screen.getByLabelText("Organization name"), "Private recovery name"); await user.click(screen.getByRole("button", { name: "Review details" })); await user.click(screen.getByRole("button", { name: "Confirm and save" }));
    await screen.findByText(/Connection interrupted/); first.unmount();
    const recovered = render(<CommandForm {...props} />);
    expect(await screen.findByText("Private recovery name")).toBeVisible(); expect(screen.getByRole("button", { name: "Change details" })).toBeDisabled();
    recovered.rerender(<CommandForm {...props} actorId="actor-b" />);
    expect(screen.queryByText("Private recovery name")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Confirm and save" })).not.toBeInTheDocument();
    recovered.rerender(<CommandForm {...props} />); expect(await screen.findByText("Private recovery name")).toBeVisible();
  });
});
describe("organization report disclosures", () => {
  const view: CooperativeView = { actorId: "test-actor", organizationId: "test", name: "Test", role: "BUYER", asOf: "2026-11-24T08:00:00Z", section: "lots", nextCursor: null, members: [], farms: [], forecasts: [], lots: [], entries: [], inventory: [], inventoryAggregates: [], payments: [], forecastTotals: [], published: [{ product: "Maize", unit: "KG", quantity: "4.2" }] };
  it("renders only the buyer publication and states its limits", () => {
    render(<CooperativeReport view={view} />);
    expect(screen.getByText("Maize: 4.2 KG in stock")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Accepted produce and payments" })).not.toBeInTheDocument();
    expect(screen.getByText(/no reservation, order, payment or custody guarantee/)).toBeVisible();
  });
  it("labels forecasts as farmer-declared estimates and separates payment bookkeeping", () => {
    render(<CooperativeReport view={{ ...view, role: "MANAGER", published: [], forecastTotals: [{ product: "Maize", unit: "KG", quantity: "3", harvestFrom: "2026-12-01", harvestTo: "2026-12-31" }] }} />);
    expect(screen.getByRole("heading", { name: /Farmer-declared forecasts/ })).toBeVisible();
    expect(screen.getByText("Maize: 3 KG, 2026-12-01 to 2026-12-31")).toBeVisible();
    expect(screen.getByText(/MyFarm has not sent any money/)).toBeVisible();
  });
});
