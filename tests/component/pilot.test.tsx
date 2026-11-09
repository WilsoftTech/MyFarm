import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CohortMeasures } from "@/components/pilot/cohort-measures";
import { JoinPilotForm, LeavePilotForm } from "@/components/pilot/pilot-forms";
import type { CohortView } from "@/modules/field-pilot/contracts/pilot";
import { pilotMeasures } from "@/modules/field-pilot/domain/measures";
import { PILOT_CONSENT_POINTS } from "@/modules/field-pilot/domain/consent";

const id = () => crypto.randomUUID();
const window = { startOn: "2027-03-01", endOn: "2027-06-20" };
const a = { participationId: id(), userId: id(), pseudonym: "P-01", status: "ENROLLED" as const, enrolledOn: "2027-03-01" };
const b = { ...a, participationId: id(), userId: id(), pseudonym: "P-02" };
function view(today: string, receipts: { actorId: string; day: string }[] = [], prompts: { participationId: string; day: string }[] = []): CohortView {
  const measures = pilotMeasures({ window, today, participants: [a, b], receipts: receipts.map(row => ({ tenantId: id(), requestId: id(), action: "ACCOUNTING_EXPENSE_RECORDED", ...row })), usage: [], prompts, incidents: [] });
  return { cohort: { cohortId: id(), name: "Rukungiri A", code: "RUK2027A", ...window, status: "ACTIVE", joined: 2 }, asOf: today + "T09:00:00.000Z", today, measures, participants: [], incidents: [] };
}
const figure = (label: string) => within(screen.getByRole("region", { name: "The ten measures" })).getByText(label).nextElementSibling?.textContent;

describe("staff cohort view (P09-T003, D-P09-007)", () => {
  it("shows all ten measures, with reasons instead of 0 when nothing can be worked out yet", () => {
    render(<CohortMeasures view={view("2027-03-03")} />);
    for (const label of ["Farmers onboarded", "Kept using it without a reminder", "Records per farmer this week", "Expenses recorded", "Harvests recorded", "Tasks completed", "Entries sent from phones", "Sync failures", "Support incidents", "Farmers who finished a crop or batch"]) expect(figure(label)).toBeDefined();
    expect(figure("Farmers onboarded")).toBe("2");
    expect(figure("Sync failures")).toBe("0 · Not available: nothing sent from phones yet");
    expect(screen.getByText("Week 1 of the cohort, so far. Each saved record is counted once, however many times a phone retried it.")).toBeTruthy();
  });
  it("names farmers only by code name, and marks reminded weeks", () => {
    const weeks = ["2027-03-02", "2027-03-09", "2027-03-16"];
    render(<CohortMeasures view={view("2027-03-25", weeks.map(day => ({ actorId: a.userId, day })), [{ participationId: a.participationId, day: "2027-03-10" }])} />);
    const farmers = screen.getByRole("list", { name: "Farmers by code name" });
    expect(within(farmers).getAllByRole("listitem").map(item => item.querySelector("p")?.textContent)).toEqual(["P-01 · joined in week 1", "P-02 · joined in week 1"]);
    expect(within(farmers).getByText(/Week 1: Used · Week 2: Used after reminder · Week 3: Used · Week 4: No records/)).toBeTruthy();
    expect(document.body.textContent).not.toContain(a.userId);
  });
  it("says when a gate has not been judged yet, and states the result once it has", () => {
    const { unmount } = render(<CohortMeasures view={view("2027-04-01")} />);
    expect(within(screen.getByRole("region", { name: "Are farmers continuing without being pushed?" })).getByText("Not judged yet: week 8 has not ended.")).toBeTruthy();
    unmount();
    const steady = ["2027-04-06", "2027-04-13", "2027-04-20", "2027-04-27"].map(day => ({ actorId: a.userId, day }));
    render(<CohortMeasures view={view("2027-05-01", steady)} />);
    expect(screen.getByText(/1 of 2 farmers kept using MyFarm without a reminder \(at least half needed\)/).textContent).toContain("1 of 2");
    expect(screen.getByText("Met")).toBeTruthy();
  });
});

describe("joining and leaving (D-P09-006, D-P09-009)", () => {
  it("shows every consent point and does not join without the box ticked", async () => {
    const submit = vi.fn(async () => undefined);
    render(<JoinPilotForm submit={submit} />);
    for (const point of PILOT_CONSENT_POINTS) expect(screen.getByText(point)).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Pilot code"), "ruk-2027a");
    await userEvent.click(screen.getByRole("button", { name: "Join the pilot" }));
    expect(await screen.findByText("Tick the box to agree, or leave this page.")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("I have read this and I agree to join the pilot."));
    await userEvent.click(screen.getByRole("button", { name: "Join the pilot" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ code: "RUK2027A", agreed: true }));
  });
  it("leaving needs a clear yes, and says what leaving does", async () => {
    const submit = vi.fn(async () => undefined);
    render(<LeavePilotForm submit={submit} version={3} />);
    expect(screen.getByText(/stops counting anything about you, including what was counted before/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Leave the pilot" }));
    expect(await screen.findByText("Tick the box if you want to leave.")).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText("Yes, I want to leave the pilot."));
    await userEvent.click(screen.getByRole("button", { name: "Leave the pilot" }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ confirmed: true, expectedVersion: 3 }));
  });
});
