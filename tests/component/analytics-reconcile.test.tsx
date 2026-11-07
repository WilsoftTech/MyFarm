import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReconcileNotice } from "@/components/analytics/reconcile";
import { RECONCILE_CHECKS } from "@/modules/analytics-profitability/domain/reconcile";

describe("reconciliation notice (P08-T012, MYF-P08-R004)", () => {
  it("shows nothing when the figures add up", () => {
    const { container } = render(<ReconcileNotice reconciliation={{ reconciled: true, checked: 8, failures: [] }} />);
    expect(container.textContent).toBe("");
  });
  it("says plainly which figure does not add up and not to rely on the page", () => {
    render(<ReconcileNotice reconciliation={{ reconciled: false, checked: 8, failures: [{ check: "SURPLUS", currency: "UGX", expected: "3250000", found: "-3250000" }] }} />);
    expect(screen.getByRole("heading", { name: "These figures do not add up" })).toBeTruthy();
    expect(screen.getByText(/Do not rely on the figures on this page for now\. Your records are not changed\./)).toBeTruthy();
    expect(screen.getByRole("listitem").textContent).toBe("Recorded surplus is not money earned minus money spent: UGX 3,250,000 expected, UGX -3,250,000 found.");
  });
  it.each(RECONCILE_CHECKS)("has plain words for %s", check => {
    render(<ReconcileNotice reconciliation={{ reconciled: false, checked: 1, failures: [{ check, currency: "UGX", expected: "1", found: "2" }] }} />);
    expect(screen.getByRole("listitem").textContent).toMatch(/^[A-Z][^:]+: UGX 1 expected, UGX 2 found\.$/);
  });
});
