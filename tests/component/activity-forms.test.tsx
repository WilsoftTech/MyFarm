import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ActivityConfirmForm } from "@/components/production/activity-confirm-form";

const cancel = { title: "Cancel activity", body: "It stays in your history.", confirm: "I want to cancel this activity.", pending: "Cancelling…", field: { name: "reason", label: "Why it was cancelled", optional: true } };

it("requires confirmation and keeps the retry ID and text after a failure", async () => {
  const submit = vi.fn().mockResolvedValue({ ok: false, message: "This was changed elsewhere." });
  render(<ActivityConfirmForm {...cancel} version={2} submit={submit} />);
  const button = screen.getByRole("button", { name: "Cancel activity" });
  expect(button).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/Why it was cancelled/), "Rain");
  await userEvent.click(screen.getByRole("checkbox", { name: "I want to cancel this activity." }));
  await userEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toEqual({ requestId: expect.any(String), expectedVersion: 2, reason: "Rain", confirmed: true });
  expect(screen.getByRole("alert")).toHaveTextContent("This was changed elsewhere.");
  await userEvent.click(button);
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
  expect(screen.getByLabelText(/Why it was cancelled/)).toHaveValue("Rain");
});
it("requires a value when the field is not optional", async () => {
  const submit = vi.fn();
  render(<ActivityConfirmForm title="Stop repeating" body="Stops it." confirm="I want to stop this repeating activity." pending="Stopping…" version={1} field={{ name: "stopFrom", label: "Stop from", type: "date" }} submit={submit} />);
  await userEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("button", { name: "Stop repeating" })).toBeDisabled();
  await userEvent.type(screen.getByLabelText("Stop from"), "2026-11-05");
  await userEvent.click(screen.getByRole("button", { name: "Stop repeating" }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toMatchObject({ stopFrom: "2026-11-05", expectedVersion: 1, confirmed: true });
});
it("does not submit while offline", async () => {
  const submit = vi.fn();
  render(<ActivityConfirmForm {...cancel} version={1} submit={submit} />);
  await userEvent.click(screen.getByRole("checkbox"));
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Cancel activity" }));
    expect(submit).not.toHaveBeenCalled();
  } finally { online.mockRestore(); }
});
