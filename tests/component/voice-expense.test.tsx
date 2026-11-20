import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceExpenseForm } from "@/components/voice/expense-form";
import { saveVoiceDraftSchema, type VoiceDraftView } from "@/modules/voice-experience/contracts/drafts";
import { VERBATIM_SOURCE_FEED_EXAMPLE } from "@/modules/voice-experience/domain/examples";
const farmId = crypto.randomUUID(), categoryId = crypto.randomUUID(), draftId = crypto.randomUUID(), recordId = crypto.randomUUID();
const props = { farmId, farmName: "Layers farm", categories: [{ id: categoryId, label: "Feed" }], paymentMethods: [] };
const labels = { category: "Feed", paymentMethod: null, enterprise: null, season: null, plot: null, batch: null };
const reply = (body: unknown, status = 201) => new Response(JSON.stringify(body), { status });
function network(customLabels: VoiceDraftView["labels"] = labels) {
  let version = 0;
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/confirm")) return reply({ receipt: { draftId, recordId, version, payloadHash: String(version).repeat(64), confirmedAt: new Date().toISOString() } });
    const input = saveVoiceDraftSchema.parse({ review: JSON.parse(String(options?.body)).review });
    version++;
    return reply({ draft: { draftId, farmId, ...input, version, payloadHash: String(version).repeat(64), expiresAt: new Date(Date.now() + 1800000).toISOString(), labels: customLabels } });
  });
  vi.stubGlobal("fetch", fetcher); return fetcher;
}
async function fill() {
  await userEvent.selectOptions(screen.getByLabelText("Category"), categoryId);
  await userEvent.type(screen.getByLabelText("Amount"), "180000");
  await userEvent.type(screen.getByLabelText("Date"), "2026-11-20");
}
const review = () => userEvent.click(screen.getByRole("button", { name: "Review expense" }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("expense review UI (P12 T003/T006)", () => {
  it("posts only a draft until the farmer checks the details and explicitly confirms", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill();
    expect(fetcher).not.toHaveBeenCalled(); await review();
    await screen.findByRole("heading", { name: "Check this expense" });
    expect(screen.getByText("UGX 180,000")).toBeVisible(); expect(screen.getByText("Layers farm")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm expense" })).toBeDisabled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.click(screen.getByRole("button", { name: "Confirm expense" }));
    await screen.findByRole("heading", { name: "Expense saved" });
    expect(screen.getByRole("link", { name: "Open saved expense" })).toHaveAttribute("href", `/farms/${farmId}/accounting/records/${recordId}`);
    const confirmation = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(confirmation).toMatchObject({ confirmed: true, version: 1, payloadHash: "1".repeat(64) }); expect(confirmation).not.toHaveProperty("amount");
  });
  it("editing the mistaken total reuses the expense mutation but requires a new review and unchecked confirmation", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill(); await review(); await screen.findByText("UGX 180,000");
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByLabelText("Amount")).toHaveValue("180000"); await userEvent.clear(screen.getByLabelText("Amount")); await userEvent.type(screen.getByLabelText("Amount"), "90000");
    await review(); await screen.findByText("UGX 90,000");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(fetcher.mock.calls[1][1]?.method).toBe("PATCH");
    const first = JSON.parse(String(fetcher.mock.calls[0][1]?.body)), edit = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(edit.review.command.requestId).toBe(first.review.command.requestId); expect(edit.version).toBe(1);
  });
  it("discarding a review creates no expense and clears the details", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill(); await review(); await screen.findByText("UGX 180,000");
    await userEvent.click(screen.getByRole("button", { name: "Discard review" }));
    expect(screen.getByLabelText("Amount")).toHaveValue(""); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("a lost confirmation response locks edits and retries the identical grant", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill(); await review(); await screen.findByText("UGX 180,000");
    fetcher.mockRejectedValueOnce(new Error("lost response"));
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.click(screen.getByRole("button", { name: "Confirm expense" }));
    await screen.findByRole("button", { name: "Retry this confirmation" });
    expect(screen.getByRole("button", { name: "Edit details" })).toBeDisabled(); expect(screen.getByRole("button", { name: "Discard review" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Retry this confirmation" }));
    await screen.findByRole("heading", { name: "Expense saved" });
    expect(fetcher.mock.calls[1][1]?.body).toBe(fetcher.mock.calls[2][1]?.body);
  });
  it("keeps typed details offline and offers the established offline workflow", async () => {
    const fetcher = network(); const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<VoiceExpenseForm {...props} />); await fill();
    online.mockReturnValue(false); act(() => window.dispatchEvent(new Event("offline")));
    await waitFor(() => expect(screen.getByRole("button", { name: "Review expense" })).toBeDisabled());
    expect(screen.getByLabelText("Amount")).toHaveValue("180000"); expect(screen.getByRole("link", { name: "Offline work" })).toHaveAttribute("href", "/offline");
    expect(fetcher).not.toHaveBeenCalled(); online.mockReturnValue(true); act(() => window.dispatchEvent(new Event("online")));
    await review(); await screen.findByText("UGX 180,000");
  });
  it("shows an actionable empty category state and never posts invalid data", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} categories={[]} />);
    expect(screen.getByRole("heading", { name: "No categories are available" })).toBeVisible(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("a source suggestion preserves manually selected category and date and never confirms automatically", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill();
    await userEvent.click(screen.getByRole("button", { name: "Use example" }));
    fetcher.mockResolvedValueOnce(reply({ kind: "SUGGESTION", intent: { kind: "FEED_EXPENSE", totalAmount: "180000", currency: "UGX", bags: 2 } }));
    await userEvent.click(screen.getByRole("button", { name: "Fill from words" }));
    await screen.findByText("The amount and currency are filled in. Choose the category and date, and check the total before reviewing.");
    expect(screen.getByLabelText("Category")).toHaveValue(categoryId); expect(screen.getByLabelText("Date")).toHaveValue("2026-11-20");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await review(); await screen.findByText("2 bags are a description only. No weight is assumed and no stock will be added. The amount above is the total.");
    expect(fetcher.mock.calls.every(call => !call[0].endsWith("/confirm"))).toBe(true);
  });
  it("offers manual entry for unmeasured languages and handles provider interruption without losing words", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />);
    expect(screen.getByRole("button", { name: "Speech unavailable — use text" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Speech language"), "sw");
    await userEvent.click(screen.getByRole("button", { name: "Use example" }));
    fetcher.mockResolvedValueOnce(reply({ kind: "TEXT_FALLBACK", reason: "LANGUAGE_UNSUPPORTED" }));
    await userEvent.click(screen.getByRole("button", { name: "Fill from words" }));
    await screen.findByText("These words cannot be filled in automatically. Enter or correct the expense details below instead.");
    expect(screen.getByLabelText("Expense words")).toHaveValue(VERBATIM_SOURCE_FEED_EXAMPLE);
    fetcher.mockRejectedValueOnce(new Error("offline")); await userEvent.click(screen.getByRole("button", { name: "Fill from words" }));
    await screen.findByText("Connection interrupted. Your words are still here. You can enter the expense details below.");
    expect(screen.getByLabelText("Expense words")).toHaveValue(VERBATIM_SOURCE_FEED_EXAMPLE);
  });
  it("recovers an expense completed in another window rather than turning a rejected edit into a duplicate", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill(); await review(); await screen.findByText("UGX 180,000");
    await userEvent.click(screen.getByRole("button", { name: "Edit details" })); await userEvent.clear(screen.getByLabelText("Amount")); await userEvent.type(screen.getByLabelText("Amount"), "90000");
    fetcher.mockResolvedValueOnce(reply({ error: "CONFLICT" }, 409));
    fetcher.mockResolvedValueOnce(reply({ status: "COMPLETED", receipt: { draftId, recordId, version: 1, payloadHash: "1".repeat(64), confirmedAt: new Date().toISOString() } }, 200));
    await review(); await screen.findByRole("heading", { name: "Expense saved" });
    expect(screen.getByText("This review was already saved. Your edits were not posted. Open the saved expense before correcting it.")).toBeVisible();
    expect(fetcher).toHaveBeenCalledTimes(3); expect(fetcher.mock.calls[2][0]).toMatch(/\/status$/);
  });
  it("a review changed in another window replaces the displayed details, edit seed and confirmation consent", async () => {
    const fetcher = network(); render(<VoiceExpenseForm {...props} />); await fill(); await review(); await screen.findByText("UGX 180,000");
    const original = JSON.parse(String(fetcher.mock.calls[0][1]?.body)).review;
    fetcher.mockResolvedValueOnce(reply({ error: "CONFLICT" }, 409));
    fetcher.mockResolvedValueOnce(reply({ status: "PENDING", draft: { draftId, farmId, review: { ...original, command: { ...original.command, amount: "90000" } }, version: 2,
      payloadHash: "2".repeat(64), expiresAt: new Date(Date.now() + 1800000).toISOString(), labels } }, 200));
    await userEvent.click(screen.getByRole("checkbox")); await userEvent.click(screen.getByRole("button", { name: "Confirm expense" }));
    await screen.findByText("UGX 90,000"); expect(screen.getByRole("checkbox")).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Edit details" })); expect(screen.getByLabelText("Amount")).toHaveValue("90000");
  });
  it("keeps a choice from a later page when words fill the amount and when a saved review is edited", async () => {
    const enterpriseId = crypto.randomUUID(), empty = { items: [], nextCursor: null };
    const load = vi.fn(async () => ({ ok: true as const, page: { items: [{ id: enterpriseId, label: "Earlier flock" }], nextCursor: null } }));
    const fetcher = network({ ...labels, enterprise: "Earlier flock" });
    render(<VoiceExpenseForm {...props} links={{ pages: { enterprises: { items: [], nextCursor: crypto.randomUUID() }, seasons: empty, plots: empty, batches: empty }, load }} />);
    await fill(); await userEvent.click(screen.getByRole("button", { name: "More enterprise choices" }));
    await screen.findByRole("option", { name: "Earlier flock" }); await userEvent.selectOptions(screen.getByLabelText("Enterprise (optional)"), enterpriseId);
    await userEvent.click(screen.getByRole("button", { name: "Use example" }));
    fetcher.mockResolvedValueOnce(reply({ kind: "SUGGESTION", intent: { kind: "FEED_EXPENSE", totalAmount: "180000", currency: "UGX", bags: 2 } }));
    await userEvent.click(screen.getByRole("button", { name: "Fill from words" }));
    await screen.findByText("The amount and currency are filled in. Choose the category and date, and check the total before reviewing.");
    expect(screen.getByRole("option", { name: "Earlier flock" })).toBeInTheDocument(); expect(screen.getByLabelText("Enterprise (optional)")).toHaveValue(enterpriseId);
    await review(); await screen.findByText("enterprise: Earlier flock"); await userEvent.click(screen.getByRole("button", { name: "Edit details" }));
    expect(screen.getByRole("option", { name: "Earlier flock" })).toBeInTheDocument(); expect(screen.getByLabelText("Enterprise (optional)")).toHaveValue(enterpriseId);
  });
});
