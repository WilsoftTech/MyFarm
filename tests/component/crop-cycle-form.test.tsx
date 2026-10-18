import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CropCycleForm } from "@/components/production/crop-cycle-form";
import type { CropChoiceLoad, CropChoicePages } from "@/components/production/crop-choice-types";
import { startCropCycleSchema } from "@/modules/enterprises-seasons/contracts/crop-cycle";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
const id = () => crypto.randomUUID();
const farmId = id(), enterprise = id(), season = id(), plot = id(), crop = id();
const choices: CropChoicePages = {
  enterprises: { items: [{ id: enterprise, label: "Maize enterprise" }], nextCursor: null },
  seasons: { items: [{ id: season, label: "Season A" }], nextCursor: null },
  plots: { items: [{ id: plot, label: "North — 1 Acres", areaUnit: "ACRE" }], nextCursor: null },
  crops: { items: [{ id: crop, label: "Maize" }], nextCursor: null },
};
const loader: CropChoiceLoad = async () => ({ ok: true, page: { items: [], nextCursor: null } });
const failed: CommandSubmit = async () => ({ ok: false, message: "Try again. Your details are still here." });
async function fill() {
  await userEvent.selectOptions(screen.getByLabelText("Enterprise"), enterprise);
  await userEvent.selectOptions(screen.getByLabelText("Season"), season);
  await userEvent.selectOptions(screen.getByLabelText("Plot"), plot);
  await userEvent.selectOptions(screen.getByLabelText("Crop"), crop);
  await userEvent.type(screen.getByLabelText("Area planted"), "00.100000");
  await userEvent.type(screen.getByLabelText("Planting date"), "2026-03-01");
}
afterEach(() => vi.restoreAllMocks());
describe("crop-cycle form", () => {
  it("prevents pre-hydration edits and retains the first selection once controls become usable", async () => {
    const submit = vi.fn(failed), host = document.createElement("div"); let root: Root | undefined;
    const element = <CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />;
    host.innerHTML = renderToString(element); document.body.appendChild(host);
    try {
      expect(screen.getByLabelText("Enterprise")).toBeDisabled();
      await act(async () => { root = hydrateRoot(host, element); });
      await waitFor(() => expect(screen.getByLabelText("Enterprise")).toBeEnabled());
      await fill(); await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(startCropCycleSchema.parse(submit.mock.calls[0][0]).enterpriseId).toBe(enterprise);
    } finally { await act(async () => root?.unmount()); host.remove(); }
  });
  it("labels required controls, reports actionable errors and focuses the first invalid choice", async () => {
    const submit = vi.fn(failed); render(<CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />);
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    expect(await screen.findByText("Choose an active crop enterprise.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Enterprise")).toHaveFocus()); expect(submit).not.toHaveBeenCalled();
  });
  it("normalizes decimal input and permits missing variety/harvest with the chosen plot unit", async () => {
    const submit = vi.fn(failed); render(<CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    expect(screen.getByLabelText("Area unit")).toHaveValue("Acres"); expect(screen.getByLabelText("Area unit")).toHaveAttribute("readonly");
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(startCropCycleSchema.parse(submit.mock.calls[0][0])).toMatchObject({ areaPlanted: "0.1", areaUnit: "ACRE", variety: undefined, expectedHarvest: undefined });
  });
  it("rejects a reversed harvest date and nonpositive area before submission", async () => {
    const submit = vi.fn(failed); render(<CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    await userEvent.type(screen.getByLabelText("Expected harvest date (optional)"), "2026-02-28");
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    expect(await screen.findByText("The expected harvest must be on or after the planting date.")).toBeVisible();
    await userEvent.clear(screen.getByLabelText("Expected harvest date (optional)"));
    await userEvent.clear(screen.getByLabelText("Area planted")); await userEvent.type(screen.getByLabelText("Area planted"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    expect(await screen.findByText(/Enter a planted area greater than zero/)).toBeVisible(); expect(submit).not.toHaveBeenCalled();
  });
  it("retains the request ID after a lost response and changes it for an edited payload", async () => {
    const submit = vi.fn<CommandSubmit>(async () => { throw new Error("lost response"); }); render(<CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    expect(await screen.findByText(/Connection interrupted/)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    const first = startCropCycleSchema.parse(submit.mock.calls[0][0]); expect(startCropCycleSchema.parse(submit.mock.calls[1][0]).requestId).toBe(first.requestId);
    await userEvent.type(screen.getByLabelText("Reason for extra planted area (optional)"), "Recorded overlap");
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(3)); expect(startCropCycleSchema.parse(submit.mock.calls[2][0]).requestId).not.toBe(first.requestId);
    expect(screen.getByLabelText("Area planted")).toHaveValue("00.100000"); expect(screen.queryByText("Crop cycle saved.")).not.toBeInTheDocument();
  });
  it("disables offline saves and preserves the open draft through reconnect", async () => {
    let connected = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => connected);
    const submit = vi.fn(failed); render(<CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    act(() => { connected = false; window.dispatchEvent(new Event("offline")); });
    expect(screen.getByRole("button", { name: "Save crop cycle" })).toBeDisabled(); expect(screen.getByText(/Keep this page open/)).toBeVisible();
    expect(screen.getByLabelText("Area planted")).toHaveValue("00.100000"); expect(submit).not.toHaveBeenCalled();
    act(() => { connected = true; window.dispatchEvent(new Event("online")); });
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" })); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
  it("announces pending writes and prevents double submission", async () => {
    let finish: (() => void) | undefined;
    const submit = vi.fn(() => new Promise<undefined>(resolve => { finish = () => resolve(undefined); }));
    render(<CropCycleForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    await userEvent.click(screen.getByRole("button", { name: "Save crop cycle" }));
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => finish?.()); await waitFor(() => expect(screen.getByRole("button", { name: "Save crop cycle" })).toBeEnabled()); expect(submit).toHaveBeenCalledTimes(1);
  });
  it("loads later choices without dropping selection/draft, and supports retry after load failure", async () => {
    let calls = 0; const extra = id();
    const load = vi.fn<CropChoiceLoad>(async () => ++calls === 1 ? { ok: false, message: "Could not load choices" } : { ok: true, page: { items: [{ id: extra, label: "South — 2 Hectares", areaUnit: "HECTARE" }], nextCursor: null } });
    render(<CropCycleForm farmId={farmId} choices={{ ...choices, plots: { ...choices.plots, nextCursor: id() } }} submit={failed} load={load} />); await fill();
    await userEvent.click(screen.getByRole("button", { name: "More plot choices" })); expect(await screen.findByText("Could not load choices")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "More plot choices" })); expect(await screen.findByRole("option", { name: "South — 2 Hectares" })).toBeVisible();
    expect(screen.getByLabelText("Plot")).toHaveValue(plot); expect(screen.getByLabelText("Area planted")).toHaveValue("00.100000");
    await userEvent.selectOptions(screen.getByLabelText("Plot"), extra); expect(screen.getByLabelText("Area unit")).toHaveValue("Hectares");
  });
  it("offers scoped prerequisite links when records are absent or have no measured plot", () => {
    render(<CropCycleForm farmId={farmId} choices={{ ...choices, plots: { items: [{ id: id(), label: "Unknown — area not recorded", disabled: true }], nextCursor: null }, enterprises: { items: [], nextCursor: null } }} submit={failed} load={loader} />);
    expect(screen.getByRole("heading", { name: "Set up this farm before planting" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add enterprise" })).toHaveAttribute("href", `/farms/${farmId}/enterprises/new`);
    expect(screen.getByRole("link", { name: "Open farm plots" })).toHaveAttribute("href", `/farms/${farmId}`);
    expect(screen.queryByRole("button", { name: "Save crop cycle" })).not.toBeInTheDocument();
  });
});
