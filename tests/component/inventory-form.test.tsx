import { afterEach, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordForm } from "@/components/production/record-form";
afterEach(() => vi.restoreAllMocks());
const load = async () => ({ ok: true as const, page: { items: [], nextCursor: null } });
it("preserves input and stable request identity after a failed write", async () => {
  const submit = vi.fn().mockResolvedValue({ ok: false, message: "Retry after reconnecting" });
  render(<RecordForm label="Add store" fields={[{ name: "name", label: "Store name" }]} submit={submit} load={load} />);
  await userEvent.type(screen.getByLabelText("Store name"), "Main store");
  await userEvent.click(screen.getByRole("button", { name: "Add store" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Retry");
  await userEvent.click(screen.getByRole("button", { name: "Add store" }));
  expect(submit.mock.calls[0][0]).toEqual(submit.mock.calls[1][0]);
  expect(screen.getByLabelText("Store name")).toHaveValue("Main store");
});
it("keeps an offline draft and disables its write control", async () => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const submit = vi.fn();
  render(<RecordForm label="Save harvest" fields={[{ name: "quantity", label: "Kilograms" }]} submit={submit} load={load} />);
  await userEvent.type(screen.getByLabelText("Kilograms"), "2400");
  await act(async () => { window.dispatchEvent(new Event("offline")); });
  expect(screen.getByRole("button", { name: "Save harvest" })).toBeDisabled();
  expect(screen.getByLabelText("Kilograms")).toHaveValue("2400"); expect(submit).not.toHaveBeenCalled();
});
