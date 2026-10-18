import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PoultryBatchForm } from "@/components/production/poultry-batch-form";
import type { PoultryChoiceLoad, PoultryChoicePages } from "@/components/production/choice-types";
import { startPoultryBatchSchema } from "@/modules/enterprises-seasons/contracts/poultry-batch";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
const id = () => crypto.randomUUID();
const farmId = id(), enterprise = id(), chicken = id();
const choices: PoultryChoicePages = {
  enterprises: { items: [{ id: enterprise, label: "Layers" }, { id: id(), label: "Maize — not a poultry enterprise", disabled: true }], nextCursor: null },
  "animal-types": { items: [{ id: chicken, label: "Chicken" }], nextCursor: null },
};
const loader: PoultryChoiceLoad = async () => ({ ok: true, page: { items: [], nextCursor: null } });
const failed: CommandSubmit = async () => ({ ok: false, message: "Try again. Your details are still here." });
async function fill(quantity = "0100") {
  await userEvent.selectOptions(screen.getByLabelText("Enterprise"), enterprise);
  await userEvent.type(screen.getByLabelText("Batch name"), "  Batch   #004 ");
  await userEvent.selectOptions(screen.getByLabelText("Animal type"), chicken);
  await userEvent.selectOptions(screen.getByLabelText("Production purpose"), "EGGS");
  await userEvent.type(screen.getByLabelText("Starting number of birds"), quantity);
  await userEvent.type(screen.getByLabelText("Acquisition date"), "2026-03-01");
}
const save = () => userEvent.click(screen.getByRole("button", { name: "Save poultry batch" }));
afterEach(() => vi.restoreAllMocks());
describe("poultry batch form", () => {
  it("prevents pre-hydration edits and retains the first selection once controls become usable", async () => {
    const submit = vi.fn(failed), host = document.createElement("div"); let root: Root | undefined;
    const element = <PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />;
    host.innerHTML = renderToString(element); document.body.appendChild(host);
    try {
      expect(screen.getByLabelText("Enterprise")).toBeDisabled();
      await act(async () => { root = hydrateRoot(host, element); });
      await waitFor(() => expect(screen.getByLabelText("Enterprise")).toBeEnabled());
      await fill(); await save();
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      expect(startPoultryBatchSchema.parse(submit.mock.calls[0][0]).enterpriseId).toBe(enterprise);
    } finally { await act(async () => root?.unmount()); host.remove(); }
  });
  it("labels required controls, reports actionable errors and focuses the first invalid choice", async () => {
    const submit = vi.fn(failed); render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />);
    await save();
    expect(await screen.findByText("Choose an active poultry enterprise.")).toBeVisible();
    expect(screen.getByText("Choose a production purpose.")).toBeVisible();
    expect(screen.getByText("Enter a batch name, for example Batch #004.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Enterprise")).toHaveFocus()); expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole("option", { name: "Maize — not a poultry enterprise" })).toBeDisabled();
  });
  it("normalizes the whole count and label, and permits a missing breed", async () => {
    const submit = vi.fn(failed); render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    await save(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(startPoultryBatchSchema.parse(submit.mock.calls[0][0])).toMatchObject({ startingQuantity: 100, batchLabel: "Batch #004", breed: undefined, purpose: "EGGS", acquisitionDate: "2026-03-01" });
  });
  it("accepts zero birds", async () => {
    const submit = vi.fn(failed); render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill("0");
    await save(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(startPoultryBatchSchema.parse(submit.mock.calls[0][0]).startingQuantity).toBe(0);
  });
  it.each(["1.5", "-3", "2.0", "1e2", "ten"])("rejects fractional, negative or malformed birds %s before submission", async quantity => {
    const submit = vi.fn(failed); render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill(quantity);
    await save();
    expect(await screen.findByText("Enter the number of birds as a whole number, 0 or more.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Starting number of birds")).toHaveFocus()); expect(submit).not.toHaveBeenCalled();
  });
  it("shows a server conflict, keeps the draft and starts a new intent after the label is edited", async () => {
    const submit = vi.fn<CommandSubmit>(async () => ({ ok: false, message: "Another batch on this farm may already use this name" })); render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    await save(); expect(await screen.findByText(/already use this name/)).toBeVisible();
    expect(screen.getByLabelText("Batch name")).toHaveValue("  Batch   #004 ");
    await save(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    const first = startPoultryBatchSchema.parse(submit.mock.calls[0][0]); expect(startPoultryBatchSchema.parse(submit.mock.calls[1][0]).requestId).toBe(first.requestId);
    await userEvent.type(screen.getByLabelText("Batch name"), "b"); await save(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    expect(startPoultryBatchSchema.parse(submit.mock.calls[2][0])).toMatchObject({ batchLabel: "Batch #004 b" });
    expect(startPoultryBatchSchema.parse(submit.mock.calls[2][0]).requestId).not.toBe(first.requestId);
  });
  it("disables offline saves and preserves the open draft through reconnect", async () => {
    let connected = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => connected);
    const submit = vi.fn(failed); render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    act(() => { connected = false; window.dispatchEvent(new Event("offline")); });
    expect(screen.getByRole("button", { name: "Save poultry batch" })).toBeDisabled(); expect(screen.getByText(/You are offline/)).toBeVisible();
    expect(screen.getByLabelText("Starting number of birds")).toHaveValue("0100"); expect(submit).not.toHaveBeenCalled();
    act(() => { connected = true; window.dispatchEvent(new Event("online")); });
    await save(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
  it("announces pending writes and prevents double submission", async () => {
    let finish: (() => void) | undefined;
    const submit = vi.fn(() => new Promise<undefined>(resolve => { finish = () => resolve(undefined); }));
    render(<PoultryBatchForm farmId={farmId} choices={choices} submit={submit} load={loader} />); await fill();
    await save();
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDisabled();
    await act(async () => finish?.()); await waitFor(() => expect(screen.getByRole("button", { name: "Save poultry batch" })).toBeEnabled()); expect(submit).toHaveBeenCalledTimes(1);
  });
  it("loads later animal types without dropping the draft, and retries after a load failure", async () => {
    let calls = 0; const duck = id();
    const load = vi.fn<PoultryChoiceLoad>(async () => ++calls === 1 ? { ok: false, message: "Could not load choices" } : { ok: true, page: { items: [{ id: duck, label: "Duck" }], nextCursor: null } });
    render(<PoultryBatchForm farmId={farmId} choices={{ ...choices, "animal-types": { ...choices["animal-types"], nextCursor: id() } }} submit={failed} load={load} />); await fill();
    await userEvent.click(screen.getByRole("button", { name: "More animal type choices" })); expect(await screen.findByText("Could not load choices")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "More animal type choices" })); expect(await screen.findByRole("option", { name: "Duck" })).toBeVisible();
    expect(load).toHaveBeenLastCalledWith("animal-types", expect.any(String));
    expect(screen.getByLabelText("Animal type")).toHaveValue(chicken); expect(screen.getByLabelText("Starting number of birds")).toHaveValue("0100");
  });
  it("offers a scoped prerequisite link when no active poultry enterprise exists", () => {
    render(<PoultryBatchForm farmId={farmId} choices={{ ...choices, enterprises: { items: [{ id: id(), label: "Maize — not a poultry enterprise", disabled: true }], nextCursor: null } }} submit={failed} load={loader} />);
    expect(screen.getByRole("heading", { name: "Set up this farm before adding a batch" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Add enterprise" })).toHaveAttribute("href", `/farms/${farmId}/enterprises/new`);
    expect(screen.queryByRole("button", { name: "Save poultry batch" })).not.toBeInTheDocument();
  });
});
