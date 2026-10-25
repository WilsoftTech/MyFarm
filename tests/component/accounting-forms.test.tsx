import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "@/components/accounting/transaction-form";
import { PaymentForm } from "@/components/accounting/payment-form";
import { ReversalForm } from "@/components/accounting/reversal-form";
import { formatMoney, recordKindFromSlug } from "@/components/accounting/labels";
import { confirmReversalSchema, recordExpenseSchema, recordSaleSchema, settleObligationSchema } from "@/modules/farm-accounting/contracts/accounting";
import type { CommandSubmit } from "@/modules/engineering-foundation/contracts/command-result";
const id = () => crypto.randomUUID();
const fertilizer = id(), cropSales = id(), mobileMoney = id();
const costCategories = [{ id: id(), label: "Seeds" }, { id: fertilizer, label: "Fertilizer" }];
const methods = [{ id: id(), label: "Cash" }, { id: mobileMoney, label: "Mobile Money" }];
const failed: CommandSubmit = async () => ({ ok: false, message: "Try again. Your details are still here." });
afterEach(() => vi.restoreAllMocks());

async function fillExpense(amount = "0150000") {
  await userEvent.selectOptions(screen.getByLabelText("Category"), fertilizer);
  await userEvent.type(screen.getByLabelText("Amount"), amount);
  await userEvent.clear(screen.getByLabelText("Currency")); await userEvent.type(screen.getByLabelText("Currency"), "ugx");
  await userEvent.type(screen.getByLabelText("Date"), "2027-03-10");
  await userEvent.type(screen.getByLabelText("Paid to (optional)"), "  ABC   Agro ");
}
const saveExpense = () => userEvent.click(screen.getByRole("button", { name: "Save expense" }));

describe("transaction form (P04-T003)", () => {
  it("normalizes money, currency and counterparty, and offers how an expense was paid", async () => {
    const submit = vi.fn(failed); render(<TransactionForm kind="EXPENSE" categories={costCategories} paymentMethods={methods} submit={submit} />);
    await fillExpense(); await userEvent.selectOptions(screen.getByLabelText("How it was paid (optional)"), mobileMoney);
    await saveExpense(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(recordExpenseSchema.parse(submit.mock.calls[0][0])).toMatchObject({ categoryId: fertilizer, amount: "150000", currency: "UGX", occurredOn: "2027-03-10", counterparty: "ABC Agro", paymentMethodId: mobileMoney });
  });
  it("keeps sales free of a payment method field and sends a strict sale command", async () => {
    const submit = vi.fn(failed); render(<TransactionForm kind="SALE" categories={[{ id: cropSales, label: "Crop sales" }]} paymentMethods={[]} submit={submit} />);
    expect(screen.queryByLabelText(/How it was/)).not.toBeInTheDocument(); expect(screen.getByLabelText("Buyer (optional)")).toBeVisible();
    await userEvent.selectOptions(screen.getByLabelText("Category"), cropSales);
    await userEvent.type(screen.getByLabelText("Amount"), "200000"); await userEvent.type(screen.getByLabelText("Date"), "2027-06-01");
    await userEvent.click(screen.getByRole("button", { name: "Save sale" })); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(recordSaleSchema.parse(submit.mock.calls[0][0])).toMatchObject({ amount: "200000", currency: "UGX", counterparty: undefined });
  });
  it("labels errors, focuses the first invalid control and never submits invalid money", async () => {
    const submit = vi.fn(failed); render(<TransactionForm kind="EXPENSE" categories={costCategories} paymentMethods={methods} submit={submit} />);
    await saveExpense();
    expect(await screen.findByText("Choose a category.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Category")).toHaveFocus());
    for (const amount of ["150,000", "1e5", "-5", "0", "1.23456"]) {
      await userEvent.clear(screen.getByLabelText("Amount")); await fillExpense(amount); await saveExpense();
      expect(await screen.findByText("Enter an amount above 0 using digits, with up to 4 decimal places.")).toBeVisible();
      await userEvent.clear(screen.getByLabelText("Date")); await userEvent.clear(screen.getByLabelText("Paid to (optional)"));
    }
    expect(submit).not.toHaveBeenCalled();
  });
  it("rejects an unknown currency before submission", async () => {
    const submit = vi.fn(failed); render(<TransactionForm kind="INCOME" categories={costCategories} paymentMethods={methods} submit={submit} />);
    await userEvent.selectOptions(screen.getByLabelText("Category"), fertilizer); await userEvent.type(screen.getByLabelText("Amount"), "5");
    await userEvent.clear(screen.getByLabelText("Currency")); await userEvent.type(screen.getByLabelText("Currency"), "XYZ"); await userEvent.type(screen.getByLabelText("Date"), "2027-03-10");
    await userEvent.click(screen.getByRole("button", { name: "Save other income" }));
    expect(await screen.findByText("Choose a currency, for example UGX.")).toBeVisible(); expect(submit).not.toHaveBeenCalled();
  });
  it("keeps the draft and request ID through a failed save, and starts a new intent after an edit", async () => {
    const submit = vi.fn(failed); render(<TransactionForm kind="EXPENSE" categories={costCategories} paymentMethods={methods} submit={submit} />); await fillExpense();
    await saveExpense(); expect(await screen.findByText("Try again. Your details are still here.")).toBeVisible();
    expect(screen.getByLabelText("Amount")).toHaveValue("0150000");
    await saveExpense(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
    const first = recordExpenseSchema.parse(submit.mock.calls[0][0]);
    expect(recordExpenseSchema.parse(submit.mock.calls[1][0]).requestId).toBe(first.requestId);
    await userEvent.type(screen.getByLabelText("Amount"), "1"); await saveExpense(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(3));
    expect(recordExpenseSchema.parse(submit.mock.calls[2][0]).requestId).not.toBe(first.requestId);
  });
  it("disables offline saves and preserves the draft through reconnect", async () => {
    let connected = true; vi.spyOn(navigator, "onLine", "get").mockImplementation(() => connected);
    const submit = vi.fn(failed); render(<TransactionForm kind="EXPENSE" categories={costCategories} paymentMethods={methods} submit={submit} />); await fillExpense();
    act(() => { connected = false; window.dispatchEvent(new Event("offline")); });
    expect(screen.getByRole("button", { name: "Save expense" })).toBeDisabled(); expect(screen.getByText(/You are offline/)).toBeVisible();
    expect(screen.getByLabelText("Amount")).toHaveValue("0150000");
    act(() => { connected = true; window.dispatchEvent(new Event("online")); });
    await saveExpense(); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  });
  it("explains an empty category list instead of showing a form", () => {
    render(<TransactionForm kind="SALE" categories={[]} paymentMethods={[]} submit={failed} />);
    expect(screen.getByRole("heading", { name: "No categories are available" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Save sale" })).not.toBeInTheDocument();
  });
});

describe("payment form (P04-T003)", () => {
  it("prefills what is still due and sends only the screen command", async () => {
    const submit = vi.fn(failed); render(<PaymentForm kind="SALE" outstanding="120000" currency="UGX" paymentMethods={methods} submit={submit} />);
    expect(screen.getByText("UGX 120,000")).toBeVisible(); expect(screen.getByLabelText("Amount received (UGX)")).toHaveValue("120000");
    await userEvent.clear(screen.getByLabelText("Amount received (UGX)")); await userEvent.type(screen.getByLabelText("Amount received (UGX)"), "80000");
    await userEvent.type(screen.getByLabelText("Date received"), "2027-06-05"); await userEvent.selectOptions(screen.getByLabelText("How it was received"), mobileMoney);
    await userEvent.click(screen.getByRole("button", { name: "Record money received" })); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(settleObligationSchema.parse(submit.mock.calls[0][0])).toMatchObject({ amount: "80000", paidOn: "2027-06-05", paymentMethodId: mobileMoney });
    expect(Object.keys(submit.mock.calls[0][0] as object).sort()).toEqual(["amount", "externalReference", "paidOn", "paymentMethodId", "requestId"]);
  });
  it("requires how the money moved and a valid date for a purchase payment", async () => {
    const submit = vi.fn(failed); render(<PaymentForm kind="PURCHASE" outstanding="150000" currency="UGX" paymentMethods={methods} submit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: "Record a payment" }));
    expect(await screen.findByText("Choose how the money moved.")).toBeVisible(); expect(screen.getByText("Enter a valid date as YYYY-MM-DD.")).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText("Date paid")).toHaveFocus()); expect(submit).not.toHaveBeenCalled();
  });
});

describe("reversal form (P04-T003)", () => {
  it("requires a reason and explicit confirmation before reversing", async () => {
    const submit = vi.fn(failed); render(<ReversalForm label="this sale" note="" submit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: "Reverse this sale" }));
    expect(await screen.findByText("Explain why this record is being reversed.")).toBeVisible();
    expect(screen.getByText("Confirm that you want to reverse this record.")).toBeVisible(); expect(submit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("Reason"), "  Entered   twice "); await userEvent.click(screen.getByLabelText("I understand that reversing is final."));
    await userEvent.click(screen.getByRole("button", { name: "Reverse this sale" })); await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(confirmReversalSchema.parse(submit.mock.calls[0][0])).toMatchObject({ reason: "Entered twice", confirmed: true });
  });
});

describe("accounting display helpers (P04-T003)", () => {
  it.each([["150000", "UGX", "UGX 150,000"], ["1234567.5", "USD", "USD 1,234,567.5"], ["0.0001", "UGX", "UGX 0.0001"], ["999", "KES", "KES 999"]])("formats %s %s without arithmetic", (amount, currency, expected) => {
    expect(formatMoney(amount, currency)).toBe(expected);
  });
  it("maps only known URL kinds, including prototype keys, to record kinds", () => {
    expect(recordKindFromSlug("sale")).toBe("SALE"); expect(recordKindFromSlug("SALE")).toBeNull();
    expect(recordKindFromSlug("__proto__")).toBeNull(); expect(recordKindFromSlug("toString")).toBeNull();
  });
});
