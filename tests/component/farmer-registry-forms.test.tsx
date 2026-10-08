import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FarmerProfileForm } from "@/components/farmer-registry/farmer-profile-form";
import { FarmForm } from "@/components/farmer-registry/farm-form";
import { PlotForm } from "@/components/farmer-registry/plot-form";

const uuid = /^[0-9a-f-]{36}$/;

describe("farmer registration form", () => {
it("announces missing required fields, focuses the first, and does not submit", async () => {
const submit = vi.fn(); render(<FarmerProfileForm submit={submit} />);
await userEvent.click(screen.getByRole("button", { name: "Register" }));
expect(await screen.findByText("Enter your name.")).toBeVisible();
expect(screen.getByText("Choose how you hold your farm land.")).toBeVisible();
expect(screen.getByText("Choose at least one main activity.")).toBeVisible();
expect(screen.getByLabelText("Full name")).toHaveAttribute("aria-invalid", "true");
await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveFocus());
expect(submit).not.toHaveBeenCalled();
});
it("marks optional fields and explains the phone is not a sign-in credential", () => {
render(<FarmerProfileForm submit={vi.fn()} />);
expect(screen.getByLabelText(/^Alternative phone number/)).toHaveAccessibleName("Alternative phone number (optional)");
expect(screen.getByLabelText("Phone number")).toHaveAccessibleDescription("Used to contact you about your records. It is not used to sign in.");
expect(screen.queryByLabelText(/national id|date of birth/i)).toBeNull();
});
it("submits normalized minimal data with a stable request ID and keeps input on failure", async () => {
const submit = vi.fn(async () => ({ ok: false as const, message: "MyFarm is unavailable right now. Your details are still here. Try again." }));
render(<FarmerProfileForm submit={submit} />);
await userEvent.type(screen.getByLabelText("Full name"), "Amina N.");
await userEvent.type(screen.getByLabelText("Phone number"), "0772 123456");
await userEvent.type(screen.getByLabelText("District"), "Rukungiri");
await userEvent.selectOptions(screen.getByLabelText("How do you hold your farm land?"), "RENTED");
await userEvent.click(screen.getByLabelText("Poultry"));
await userEvent.click(screen.getByRole("button", { name: "Register" }));
expect(await screen.findByRole("alert")).toHaveTextContent("Your details are still here");
expect(screen.getByLabelText("Full name")).toHaveValue("Amina N.");
expect(submit).toHaveBeenCalledWith({ name: "Amina N.", phone: "+256772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "RENTED", mainActivities: ["POULTRY"], requestId: expect.stringMatching(uuid) });
await userEvent.click(screen.getByRole("button", { name: "Register" }));
const calls = submit.mock.calls as unknown as [{ requestId: string }][];
expect(calls[1][0].requestId).toBe(calls[0][0].requestId);
});
it("edit mode sends the expected version", async () => {
const submit = vi.fn(async () => undefined);
render(<FarmerProfileForm submit={submit} expectedVersion={3} defaults={{ name: "A", phone: "+256772123456", alternativePhone: "", district: "R", subcounty: "", village: "", preferredLanguage: "lg", ownershipType: "OWNED", mainActivities: ["CROPS"] }} />);
await userEvent.click(screen.getByRole("button", { name: "Save profile" }));
expect(submit).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 3, preferredLanguage: "lg", mainActivities: ["CROPS"] }));
});
});

describe("farm form", () => {
async function fillRequired() {
await userEvent.type(screen.getByLabelText(/^Farm name/), "Home farm");
await userEvent.type(screen.getByLabelText("District"), "Rukungiri");
await userEvent.selectOptions(screen.getByLabelText("How is this land held?"), "FAMILY");
await userEvent.selectOptions(screen.getByLabelText("Main activity on this farm"), "CROPS");
}
it("GPS is optional and hidden behind a disclosure", async () => {
const submit = vi.fn(async () => undefined); render(<FarmForm submit={submit} />);
expect(screen.getByText("GPS location (optional)").closest("details")).not.toHaveAttribute("open");
await fillRequired();
await userEvent.click(screen.getByRole("button", { name: "Save farm" }));
expect(submit).toHaveBeenCalledWith({ name: "Home farm", district: "Rukungiri", ownershipType: "FAMILY", primaryActivity: "CROPS", requestId: expect.stringMatching(uuid) });
});
it("rejects negative acreage and an incomplete coordinate pair", async () => {
const submit = vi.fn(); render(<FarmForm submit={submit} />);
await fillRequired();
await userEvent.type(screen.getByLabelText(/^Approximate size/), "-2");
await userEvent.click(screen.getByText("GPS location (optional)"));
await userEvent.type(screen.getByLabelText("Latitude"), "-0.79");
await userEvent.click(screen.getByRole("button", { name: "Save farm" }));
expect(await screen.findByText("Enter acreage as a number of zero or more, like 2 or 2.5.")).toBeVisible();
expect(screen.getByText("Enter both latitude and longitude, or leave both empty.")).toBeVisible();
expect(submit).not.toHaveBeenCalled();
});
});

describe("plot form", () => {
it("requires a unit when area is given and submits exact decimals", async () => {
const submit = vi.fn(async () => undefined); render(<PlotForm submit={submit} />);
await userEvent.type(screen.getByLabelText(/^Plot name/), "Plot A");
await userEvent.type(screen.getByLabelText("Area (optional)"), "0.75");
await userEvent.click(screen.getByRole("button", { name: "Add plot" }));
expect(await screen.findByText("Enter both the area and its unit, or leave both empty.")).toBeVisible();
await userEvent.selectOptions(screen.getByLabelText("Area unit (optional)"), "ACRE");
await userEvent.click(screen.getByRole("button", { name: "Add plot" }));
expect(submit).toHaveBeenCalledWith({ name: "Plot A", area: "0.75", areaUnit: "ACRE", requestId: expect.stringMatching(uuid) });
});
});
