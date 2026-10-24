import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnterpriseForm } from "@/components/production/enterprise-form";
import { SeasonForm } from "@/components/production/season-form";
import { ProductionShell } from "@/components/production/shell";
import { ProductionPagination } from "@/components/production/pagination";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { createEnterpriseSchema } from "@/modules/enterprises-seasons/contracts/production";

afterEach(() => vi.restoreAllMocks());
async function fillEnterprise() {
  await userEvent.type(screen.getByLabelText("Enterprise name"), "  Maize  ");
  await userEvent.selectOptions(screen.getByLabelText("Enterprise type"), "CROP");
}
describe("enterprise form", () => {
  it("labels its fields, rejects missing data and focuses the first invalid control", async () => {
    const submit = vi.fn(); render(<EnterpriseForm submit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    expect(await screen.findByText("Enter an enterprise name.")).toBeVisible();
    expect(screen.getByText("Choose an enterprise type.")).toBeVisible();
    expect(screen.getByLabelText("Enterprise name")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(screen.getByLabelText("Enterprise name")).toHaveFocus());
    expect(screen.getAllByRole("option")).toHaveLength(7); expect(submit).not.toHaveBeenCalled();
  });
  it("preserves fields and request ID when an identical save is retried", async () => {
    const submit = vi.fn<CommandSubmit>().mockResolvedValue({ ok: false, message: "Unavailable. Try again." });
    render(<EnterpriseForm submit={submit} />); await fillEnterprise();
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
    expect(screen.getByLabelText("Enterprise name")).toHaveValue("  Maize  ");
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    expect(submit.mock.calls[0][0]).toEqual({ name: "Maize", type: "CROP", requestId: expect.any(String) });
    expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
  });
  it("starts a new request after the farmer changes the normalized payload", async () => {
    const submit = vi.fn<CommandSubmit>().mockResolvedValue({ ok: false, message: "Retry" });
    render(<EnterpriseForm submit={submit} />); await fillEnterprise();
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    await screen.findByRole("alert");
    await userEvent.clear(screen.getByLabelText("Enterprise name")); await userEvent.type(screen.getByLabelText("Enterprise name"), "Coffee");
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    expect(submit.mock.calls[1][0]).toEqual({ name: "Coffee", type: "CROP", requestId: expect.any(String) });
    expect(submit.mock.calls[1][0]).not.toEqual(expect.objectContaining({ requestId: createEnterpriseSchema.parse(submit.mock.calls[0][0]).requestId }));
  });
  it("recovers from an interrupted response without announcing success or discarding values", async () => {
    const submit = vi.fn(async () => { throw new Error("network"); });
    render(<EnterpriseForm submit={submit} />); await fillEnterprise();
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByLabelText("Enterprise name")).toHaveValue("  Maize  ");
    expect(screen.queryByText("Enterprise saved.")).not.toBeInTheDocument();
  });
  it("announces saving and prevents a second click while the server is pending", async () => {
    let finish: (() => void) | undefined;
    const submit = vi.fn(() => new Promise<undefined>(resolve => { finish = () => resolve(undefined); }));
    render(<EnterpriseForm submit={submit} />); await fillEnterprise();
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Saving");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => finish?.());
    await waitFor(() => expect(screen.getByRole("button", { name: "Save enterprise" })).toBeEnabled());
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("keeps offline drafts only on the open page and enables saving after reconnection", async () => {
    let connected = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => connected);
    const submit = vi.fn(async () => undefined);
    render(<EnterpriseForm submit={submit} />); await fillEnterprise();
    act(() => { connected = false; window.dispatchEvent(new Event("offline")); });
    expect(screen.getByRole("status")).toHaveTextContent("You are offline");
    expect(screen.getByRole("button", { name: "Save enterprise" })).toBeDisabled();
    expect(screen.getByLabelText("Enterprise name")).toHaveValue("  Maize  ");
    expect(screen.getByText(/Keep this page open/)).toBeVisible();
    expect(submit).not.toHaveBeenCalled();
    act(() => { connected = true; window.dispatchEvent(new Event("online")); });
    await userEvent.click(screen.getByRole("button", { name: "Save enterprise" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
});

describe("season form", () => {
  it("validates date order and focuses the end date without writing", async () => {
    const submit = vi.fn(); render(<SeasonForm submit={submit} />);
    await userEvent.type(screen.getByLabelText("Season name"), "Season A");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-03-01");
    await userEvent.type(screen.getByLabelText("End date (optional)"), "2026-02-01");
    await userEvent.click(screen.getByRole("button", { name: "Save season" }));
    expect(await screen.findByText("The end date must be on or after the start date.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("End date (optional)")).toHaveFocus()); expect(submit).not.toHaveBeenCalled();
  });
  it("accepts a season without an end and sends the existing server contract", async () => {
    const submit = vi.fn(async () => undefined); render(<SeasonForm submit={submit} />);
    await userEvent.type(screen.getByLabelText("Season name"), "  Season A  "); await userEvent.type(screen.getByLabelText("Start date"), "2026-03-01");
    await userEvent.click(screen.getByRole("button", { name: "Save season" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ label: "Season A", startDate: "2026-03-01", endDate: undefined, requestId: expect.any(String) }));
  });
});

describe("farm-scoped navigation", () => {
  it("names the farm and keeps all navigation links in its scope", () => {
    render(<ProductionShell farm={{ farmId: "farm-a", name: "Home farm" }} active="seasons" title="Seasons"><p>Records</p></ProductionShell>);
    expect(screen.getByText("Farm: Home farm")).toBeVisible();
    expect(screen.getByRole("link", { name: "Enterprises" })).toHaveAttribute("href", "/farms/farm-a/enterprises");
    expect(screen.getByRole("link", { name: "Seasons" })).toHaveAttribute("aria-current", "location");
  });
  it("shows only available pagination controls with the same farm path", () => {
    render(<ProductionPagination path="/farms/farm-a/seasons" cursor="previous" nextCursor="next" />);
    expect(screen.getByRole("link", { name: "First page" })).toHaveAttribute("href", "/farms/farm-a/seasons");
    expect(screen.getByRole("link", { name: "More records" })).toHaveAttribute("href", "/farms/farm-a/seasons?cursor=next");
  });
});
