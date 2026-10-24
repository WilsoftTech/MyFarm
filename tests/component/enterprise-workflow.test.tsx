import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EnterpriseWorkflow } from "@/components/production/enterprise-workflow";
import { enterpriseChoice } from "@/components/production/enterprise-choice";

describe("enterprise workflow presentation", () => {
  it.each([
    ["CROP_CYCLE", "Start crop cycle", "View farm crop cycles", "crop-cycles"],
    ["POULTRY_BATCH", "Add poultry batch", "View farm poultry batches", "poultry-batches"],
  ] as const)("renders authorized %s capability as keyboard-accessible farm links", async (workflow, start, view, path) => {
    render(<EnterpriseWorkflow farmId="farm" enterprise={{ enterpriseId: "enterprise", status: "ACTIVE", workflow }} />);
    expect(screen.getByRole("link", { name: start })).toHaveAttribute("href", `/farms/farm/${path}/new?enterpriseId=enterprise`);
    expect(screen.getByRole("link", { name: view })).toHaveAttribute("href", `/farms/farm/${path}`);
    await userEvent.tab(); expect(screen.getByRole("link", { name: start })).toHaveFocus();
  });
  it.each(["CROP_CYCLE", "POULTRY_BATCH"] as const)("keeps %s history available for closed enterprises without a start control", workflow => {
    render(<EnterpriseWorkflow farmId="farm" enterprise={{ enterpriseId: "enterprise", status: "CLOSED", workflow }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /View farm/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Start|Add/ })).not.toBeInTheDocument();
  });
  it("explains unavailable production without a dead link or button", () => {
    render(<EnterpriseWorkflow farmId="farm" enterprise={{ enterpriseId: "enterprise", status: "ACTIVE", workflow: null }} />);
    expect(screen.getByText(/Production records for this enterprise type are not available yet/)).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("initial, paged and preset enterprise choices", () => {
  const row = { enterpriseId: "enterprise", name: "Farm activity", status: "ACTIVE" as const };
  it.each(["CROP_CYCLE", "POULTRY_BATCH"] as const)("enables an active %s result and labels closed or unavailable choices", workflow => {
    expect(enterpriseChoice({ ...row, workflow }, workflow)).toEqual({ id: row.enterpriseId, label: row.name, disabled: false });
    expect(enterpriseChoice({ ...row, workflow, status: "CLOSED" }, workflow)).toMatchObject({ disabled: true, label: row.name + " — closed" });
    expect(enterpriseChoice({ ...row, workflow: null }, workflow)).toMatchObject({ disabled: true, label: row.name + " — production records not available yet" });
  });
  it("refuses the other workflow while preserving its identity for visible feedback", () => {
    expect(enterpriseChoice({ ...row, workflow: "POULTRY_BATCH" }, "CROP_CYCLE")).toMatchObject({ id: row.enterpriseId, disabled: true, label: row.name + " — not a crop enterprise" });
    expect(enterpriseChoice({ ...row, workflow: "CROP_CYCLE" }, "POULTRY_BATCH")).toMatchObject({ id: row.enterpriseId, disabled: true, label: row.name + " — not a poultry enterprise" });
  });
});
