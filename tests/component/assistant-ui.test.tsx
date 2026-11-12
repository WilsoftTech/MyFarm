import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestionCard } from "@/components/assistant/answer-view";
import { AskForm } from "@/components/assistant/ask-form";
import { statementText } from "@/components/assistant/labels";
import { draftHighestProfitAnswer, highestProfitEvidence } from "@/modules/ai-assistant/domain/highest-profit";
import { plainAnswer, shownAnswer } from "@/modules/ai-assistant/domain/exchange";
import type { AssistantExchange } from "@/modules/ai-assistant/contracts/assistant";
import { AGRONOMY_REFERRAL } from "@/modules/ai-assistant/domain/policy";

const id = () => crypto.randomUUID();
const poultry = id(), maize = id();
const line = (enterpriseId: string, name: string, revenue: string, directCosts: string, grossMargin: string) => ({ enterpriseId, name, revenue, directCosts, grossMargin, marginPercent: { status: "UNAVAILABLE" as const, reason: "NO_REVENUE" as const } });
const evidence = highestProfitEvidence({ scope: { tenantId: id(), farmId: id() }, basis: "ACCRUAL", period: { kind: "SEASON", label: "2026A", startDate: "2026-03-01", endDate: null }, asOf: "2026-11-12T09:00:00.000Z", currencies: [{
  currency: "UGX", revenue: "0", expenses: "0", recordedSurplus: "0", surplusMargin: { status: "UNAVAILABLE", reason: "NO_REVENUE" }, topEnterpriseIds: [poultry],
  enterprises: [line(poultry, "Layers house", "2100000", "680000", "1420000"), line(maize, "Maize hill", "900000", "600000", "300000")],
  allEnterprises: { revenue: "0", directCosts: "0", grossMargin: "0" }, unassigned: { revenue: "0", costs: "0" },
}] })[0];
const exchange = (answers: AssistantExchange["answers"], question = "Which enterprise made me the most money?"): AssistantExchange =>
  ({ questionId: id(), question, intent: "HIGHEST_PROFIT", askedAt: "2026-11-12T09:00:00.000Z", keptUntil: "2027-02-10T09:00:00.000Z", answers });

describe("an answer on screen (MYF-P11-AC001)", () => {
  it("labels each statement, fills every figure from the evidence and states where it came from", () => {
    const answer = shownAnswer({ evidence, statements: draftHighestProfitAnswer(evidence).statements, source: "PLAIN", explainer: "NOT_ASKED", problems: [] });
    render(<ol><QuestionCard exchange={exchange([answer])} farmId="f1" remove={vi.fn(async () => undefined)} /></ol>);
    const card = screen.getByRole("article", { name: "Which enterprise made me the most money?" });
    expect(within(card).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Fact from your recordsLayers house made the most money for season 2026A: a gross margin of UGX 1,420,000.",
      "Fact from your recordsThat is UGX 2,100,000 of sales less UGX 680,000 of costs linked to Layers house.",
      "Fact from your recordsNext was Maize hill, at UGX 300,000.",
      "Not certainGross margin is sales less the costs linked to each enterprise. It is not net profit: costs shared by the farm, depreciation and loans are not taken off.",
    ]);
    expect(statementText(answer, 0)).toBe("Layers house made the most money for season 2026A: a gross margin of UGX 1,420,000.");
    expect(card).toHaveTextContent("Worked out by MyFarm from the money figures on the farm screen: season 2026A, counted when sold or bought. Calculated 2026-11-12 09:00 UTC");
    expect(card).toHaveTextContent("Worded by MyFarm.");
    expect(card).toHaveTextContent("Kept until 2027-02-10, then deleted.");
    expect(within(card).getByRole("button", { name: "Delete this question" })).toBeInTheDocument();
  });
  it("a referral rests on no figures and says it is not certain; a question is shown as text, never as markup", () => {
    render(<ol><QuestionCard exchange={exchange([shownAnswer(plainAnswer("AGRONOMY"))], "<b>spray</b> what?")} farmId="f1" remove={vi.fn(async () => undefined)} /></ol>);
    const card = screen.getByRole("article", { name: "<b>spray</b> what?" });
    expect(within(card).getByRole("listitem")).toHaveTextContent("Not certain" + AGRONOMY_REFERRAL);
    expect(card).not.toHaveTextContent("Worked out by MyFarm");
    expect(card.querySelector("b")).toBeNull();
  });
});

describe("the question box", () => {
  it("warns against names and phone numbers, sends the chosen season, and keeps an empty question from being sent", async () => {
    const submit = vi.fn(async () => undefined);
    render(<AskForm seasons={[{ seasonId: "s1", label: "2026A", closed: false }, { seasonId: "s0", label: "2025B", closed: true }]} defaultSeason="s1" submit={submit} />);
    expect(screen.getByText(/Do not type names or phone numbers/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Which records" })).toHaveValue("s1");
    expect(screen.getByRole("option", { name: "Season 2025B (closed)" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ask" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write your question, up to 500 letters.");
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: "  Which enterprise made the most money?  " } });
    fireEvent.change(screen.getByRole("combobox", { name: "Which records" }), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({ requestId: expect.any(String), question: "Which enterprise made the most money?", view: { seasonId: "all" } });
  });
});

describe("labels on screen (MYF-P11-AC003)", () => {
  it("the guide says what each label promises", async () => {
    const { LabelGuide } = await import("@/components/assistant/answer-view");
    render(<LabelGuide />);
    expect(screen.getByText("What the labels mean")).toBeInTheDocument();
    for (const [term, meaning] of [["Fact from your records", "Exactly what your records say"], ["What this suggests", "It is not certain"], ["Suggestion", "It is never certain"], ["Not certain", "advice only an extension officer should give"]]) {
      expect(screen.getByText(term, { selector: "dt" }).nextElementSibling).toHaveTextContent(meaning);
    }
  });
  it("figures MyFarm's own checks disagree on are marked, and stated only as not certain", async () => {
    const { withDisagreements } = await import("@/modules/ai-assistant/domain/evidence");
    const { explainProfitEvidence } = await import("@/modules/ai-assistant/domain/money-tools");
    const { draftAnswer } = await import("@/modules/ai-assistant/domain/tools");
    const [profit] = explainProfitEvidence({ scope: evidence.scope, basis: "ACCRUAL", period: { kind: "SEASON", label: "2026A", startDate: "2026-03-01", endDate: null }, asOf: "2026-11-12T09:00:00.000Z", currencies: [{
      currency: "UGX", revenue: "3000000", expenses: "1280000", recordedSurplus: "1720000", surplusMargin: { status: "AVAILABLE", value: "57.3" }, enterprises: [], topEnterpriseIds: [],
      allEnterprises: { revenue: "0", directCosts: "0", grossMargin: "0" }, unassigned: { revenue: "0", costs: "0" } }] });
    const disputed = withDisagreements(profit, [{ currency: "UGX", expected: "1720000", found: "1700000" }]);
    const answer = shownAnswer({ evidence: disputed, statements: draftAnswer(disputed).statements, source: "PLAIN", explainer: "NOT_ASKED", problems: [] });
    render(<ol><QuestionCard exchange={exchange([answer], "How much profit did I make?")} farmId="f1" remove={vi.fn(async () => undefined)} /></ol>);
    const items = within(screen.getByRole("article", { name: "How much profit did I make?" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Not certainMyFarm's own checks do not add up for season 2026A in this currency: one way of adding the records gives UGX 1,720,000 (does not add up), another gives UGX 1,700,000 (does not add up).");
    expect(items.every(item => item.textContent?.startsWith("Not certain"))).toBe(true);
  });
});
