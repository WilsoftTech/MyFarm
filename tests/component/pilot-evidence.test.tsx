import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FindingForm, ObservationForm, ReviewForm } from "@/components/pilot/evidence-forms";
import type { ObservationView } from "@/modules/field-pilot/domain/evidence";

const id = () => crypto.randomUUID();
const seen: ObservationView = { observationId: id(), pseudonym: "P-01", observedOn: "2027-03-03", screen: "EXPENSE_FORM", kind: "WORDING", note: "'Category' meant nothing" };

describe("evidence screens (P09-T006, MYF-P09-AC002)", () => {
  it("offers only the decisions the evidence allows today", () => {
    const { unmount } = render(<ReviewForm submit={vi.fn()} allowed={["CONTINUE"]} />);
    expect(screen.getAllByRole("radio").map(radio => radio.parentElement?.textContent)).toEqual(["Continue the pilot"]);
    unmount();
    render(<ReviewForm submit={vi.fn()} allowed={["CONTINUE", "NO_GO"]} />);
    expect(screen.queryByLabelText("Go: farmers are continuing on their own")).toBeNull();
    expect(screen.getByLabelText("No go: farmers are not continuing on their own")).toBeTruthy();
  });
  it("a finding cannot be saved without ticking at least one observation, and the observation shows its date, place and code name", async () => {
    const submit = vi.fn(async () => undefined);
    render(<FindingForm submit={submit} observations={[seen]} />);
    expect(screen.getByText("2027-03-03 · Expense form · Words not understood · P-01")).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Finding"), "Farmers do not understand 'category'");
    await userEvent.click(screen.getByRole("button", { name: "Save finding" }));
    expect(await screen.findByText("Tick at least one observation.")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Save finding" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ observationIds: [seen.observationId] }));
  });
  it("an observation names farmers by code name only and asks for no names", () => {
    render(<ObservationForm submit={vi.fn()} choices={[{ participationId: id(), pseudonym: "P-01" }]} today="2027-03-03" />);
    expect(screen.getByRole("option", { name: "P-01" })).toBeTruthy();
    expect(screen.getByText(/No names or phone numbers\./)).toBeTruthy();
  });
});
