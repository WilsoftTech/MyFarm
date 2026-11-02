import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ActivityCancelForm } from "@/components/production/activity-cancel-form";

it("requires confirmation to cancel and keeps the retry ID and reason after a failure", async () => {
  const submit = vi.fn().mockResolvedValue({ ok: false, message: "This was changed elsewhere." });
  render(<ActivityCancelForm version={2} submit={submit} />);
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
it("does not submit while offline", async () => {
  const submit = vi.fn();
  render(<ActivityCancelForm version={1} submit={submit} />);
  await userEvent.click(screen.getByRole("checkbox"));
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  try {
    await userEvent.click(screen.getByRole("button", { name: "Cancel activity" }));
    expect(submit).not.toHaveBeenCalled();
  } finally { online.mockRestore(); }
});
