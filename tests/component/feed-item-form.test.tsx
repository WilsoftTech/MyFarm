import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedItemForm } from "@/components/intelligence/feed-item-form";

const supplies = [{ itemId: "a0000000-0000-4000-8000-000000000001", name: "Layer mash", unit: "KG" }, { itemId: "a0000000-0000-4000-8000-000000000002", name: "Maize bran", unit: "BAG" }];

describe("feed item for a batch (D-P10-007)", () => {
  it("says when the chosen item cannot be compared, and only saves a change", async () => {
    const submit = vi.fn(async () => undefined);
    render(<FeedItemForm supplies={supplies} current={supplies[0].itemId} version={1} submit={submit} />);
    const save = screen.getByRole("button", { name: "Save feed item" }) as HTMLButtonElement;
    await waitFor(() => expect((screen.getByLabelText("Feed item in stock") as HTMLSelectElement).disabled).toBe(false));
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Feed item in stock"), { target: { value: supplies[1].itemId } });
    expect(screen.getByText(/not counted in kg/)).toBeTruthy();
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ itemId: supplies[1].itemId, expectedVersion: 1, requestId: expect.any(String) })));
  });
  it("starts with no choice when the batch has no feed item", () => {
    render(<FeedItemForm supplies={supplies} current={null} version={null} submit={vi.fn(async () => undefined)} />);
    expect((screen.getByLabelText("Feed item in stock") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText(/not counted in kg/)).toBeNull();
  });
});
