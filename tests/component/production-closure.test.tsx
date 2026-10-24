import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ProductionClosureForm } from "@/components/production/closure-form";

it("requires final-closure confirmation and preserves the retry ID on server failure", async () => {
  const submit = vi.fn().mockResolvedValue({ ok: false, message: "Close active crop cycles first." });
  render(<ProductionClosureForm label="season" season version={3} submit={submit} />);
  const button = screen.getByRole("button", { name: "Close season" });
  expect(button).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: "I understand that closing is final." }));
  await userEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toEqual({ requestId: expect.any(String), expectedVersion: 3, confirmed: true });
  expect(screen.getByRole("alert")).toHaveTextContent("Close active crop cycles first.");
  await userEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
});
it("keeps confirmation while offline and does not submit", async () => {
  const submit = vi.fn();
  render(<ProductionClosureForm label="crop cycle" version={1} submit={submit} />);
  await userEvent.click(screen.getByRole("checkbox"));
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("button", { name: "Close crop cycle" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("You are offline");
    expect(submit).not.toHaveBeenCalled();
  } finally { online.mockRestore(); fireEvent(window, new Event("online")); }
});
it("prevents a second confirmation while the close command is pending", async () => {
  let complete!: (value: { ok: false; message: string }) => void;
  const pending = new Promise<{ ok: false; message: string }>(resolve => { complete = resolve; });
  const submit = vi.fn(() => pending);
  render(<ProductionClosureForm label="season" version={1} submit={submit} />);
  await userEvent.click(screen.getByRole("checkbox"));
  await userEvent.click(screen.getByRole("button", { name: "Close season" }));
  expect(screen.getByRole("button", { name: "Closing…" })).toBeDisabled();
  expect(screen.getByRole("checkbox")).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Closing…" }));
  expect(submit).toHaveBeenCalledTimes(1);
  await act(async () => complete({ ok: false, message: "Try again." }));
  expect(screen.getByRole("alert")).toHaveTextContent("Try again.");
});
