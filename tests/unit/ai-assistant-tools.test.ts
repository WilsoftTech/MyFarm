import { describe, expect, it } from "vitest";
import type { CurrencyDashboard } from "@/modules/analytics-profitability/domain/profitability";
import { answerProblems, MAX_STATEMENTS, type Answer } from "@/modules/ai-assistant/domain/answer";
import { answerRules, belongsTo, TOOL_KEYS, type Evidence } from "@/modules/ai-assistant/domain/evidence";
import { explainRequest } from "@/modules/ai-assistant/domain/explain-request";
import { highestProfitEvidence, type MoneyViewInput } from "@/modules/ai-assistant/domain/highest-profit";
import { explainProfitEvidence, farmReportEvidence, MAX_REPORT_ENTERPRISES, summarizeEvidence } from "@/modules/ai-assistant/domain/money-tools";
import { compareSeasonsEvidence, COST_RULE_TITLES, earlierSeason, MAX_COST_ALERTS, MAX_RECORDS, MAX_TASKS, recordsEvidence, unusualCostsEvidence, upcomingTasksEvidence, type RecordInput, type TaskInput } from "@/modules/ai-assistant/domain/other-tools";
import { draftAnswer, TOOLS } from "@/modules/ai-assistant/domain/tools";
import { fakeExplanation } from "@/modules/ai-assistant/infrastructure/fake-provider";
import { ruleTitles } from "@/components/intelligence/labels";

const id = () => crypto.randomUUID();
const scope = { tenantId: id(), farmId: id() };
const asOf = "2026-11-13T08:00:00.000Z";
const season = { kind: "SEASON" as const, label: "2026A", startDate: "2026-03-01", endDate: "2026-07-31" };
const layers = id(), maize = id(), goats = id();
const line = (enterpriseId: string, name: string, revenue: string, directCosts: string, grossMargin: string) => ({ enterpriseId, name, revenue, directCosts, grossMargin, marginPercent: { status: "UNAVAILABLE" as const, reason: "NO_REVENUE" as const } });
function dashboard(code: string, revenue: string, expenses: string, surplus: string, enterprises: ReturnType<typeof line>[], tops: string[], margin: string | null = null, unassigned = { revenue: "0", costs: "0" }): CurrencyDashboard {
  return { currency: code, revenue, expenses, recordedSurplus: surplus, surplusMargin: margin ? { status: "AVAILABLE", value: margin } : { status: "UNAVAILABLE", reason: "NO_REVENUE" }, enterprises, topEnterpriseIds: tops,
    allEnterprises: { revenue: "0", directCosts: "0", grossMargin: "0" }, unassigned };
}
const ugx = dashboard("UGX", "3000000", "2280000", "720000", [line(layers, "Layers house", "2100000", "680000", "1420000"), line(maize, "Maize hill", "900000", "600000", "300000"), line(goats, "Goats", "0", "1000000", "-1000000")], [layers], "24", { revenue: "0", costs: "0" });
const money = (currencies: CurrencyDashboard[] = [ugx]): MoneyViewInput => ({ scope, basis: "ACCRUAL", period: season, asOf, currencies });

/** Shows an answer as the screen would: placeholders filled from the evidence only. */
function said(answer: Answer, evidence: Evidence): string[] {
  return answer.statements.map(statement => statement.kind + ": " + statement.text.replace(/\{([A-Z][0-9]{0,3})\}/g, (_, ref: string) => {
    if (ref === "P") return evidence.period?.kind === "SEASON" ? evidence.period.label : evidence.period?.kind === "DATES" ? "from " + evidence.period.from : "all records";
    const figure = evidence.figures.find(row => row.ref === ref);
    if (figure) return figure.kind === "MONEY" ? figure.currency + " " + figure.value : figure.kind === "PERCENT" ? figure.value + "%" : figure.value;
    return evidence.labels.find(row => row.ref === ref)!.text;
  }));
}
/** Every plain answer passes the same checks an explainer's must, and fits one answer. */
function checked(evidence: Evidence): string[] {
  const answer = draftAnswer(evidence);
  expect(answerProblems(answer, answerRules(evidence)), evidence.tool).toEqual([]);
  expect(answer.statements.length).toBeLessThanOrEqual(MAX_STATEMENTS);
  // Provider outage: the fake (and any fallback) builds the very same answer from the explain request alone.
  expect(fakeExplanation(explainRequest("q", evidence)).output).toEqual(answer);
  return said(answer, evidence);
}

const records: RecordInput[] = [
  { recordId: id(), kind: "SALE", categoryId: "c-egg", categoryName: "Egg sales", amount: "350000", currency: "UGX", occurredOn: "2026-11-10", enterpriseId: layers, enterpriseName: "Layers house", status: "POSTED" },
  { recordId: id(), kind: "EXPENSE", categoryId: "c-feed", categoryName: "Feed", amount: "120000.5", currency: "UGX", occurredOn: "2026-11-09", enterpriseId: null, enterpriseName: null, status: "POSTED" },
  { recordId: id(), kind: "INCOME", categoryId: "c-other", categoryName: "Other income", amount: "40", currency: "USD", occurredOn: "2026-11-08", enterpriseId: null, enterpriseName: null, status: "POSTED" },
  { recordId: id(), kind: "EXPENSE", categoryId: "c-feed", categoryName: "Feed", amount: "999999", currency: "UGX", occurredOn: "2026-11-07", enterpriseId: null, enterpriseName: null, status: "REVERSED" },
];
const task = (typeLabel: string, dueOn: string, enterpriseName: string | null = null): TaskInput => ({ activityId: id(), type: typeLabel.toUpperCase(), typeLabel, dueOn, enterpriseId: enterpriseName ? id() : null, enterpriseName });

describe("MYF-P11-AC002 seven question types: bounded, read-only, with provenance (T004 golden fixtures)", () => {
  it("covers exactly the source's seven capabilities plus the R001 example, each versioned and naming what it reads", () => {
    expect(TOOL_KEYS).toEqual(["HIGHEST_PROFIT", "ASK_RECORDS", "EXPLAIN_PROFIT", "COMPARE_SEASONS", "SUMMARIZE", "UNUSUAL_COSTS", "UPCOMING_TASKS", "FARM_REPORT"]);
    for (const key of TOOL_KEYS) expect([TOOLS[key].version, TOOLS[key].reads.length > 10]).toEqual([1, true]);
  });
  it("ask records: the latest posted records, each with its own currency and date; reversed ones left out", () => {
    const [evidence] = recordsEvidence({ scope, asOf, records, more: false });
    expect(evidence).toMatchObject({ tool: "ASK_RECORDS", scope, period: { kind: "ALL_RECORDS" }, asOf, currency: null, leftOut: 0 });
    expect(checked(evidence)).toEqual([
      "FACT: Your latest money records, newest first:",
      "FACT: 2026-11-10: Sale, Egg sales, UGX 350000, for Layers house.",
      "FACT: 2026-11-09: Expense, Feed, UGX 120000.5.",
      "FACT: 2026-11-08: Income, Other income, USD 40.",
    ]);
    const many = recordsEvidence({ scope, asOf, records: Array.from({ length: 12 }, () => records[0]).map(row => ({ ...row, recordId: id() })), more: true })[0];
    expect([many.figures.filter(row => row.measure === "AMOUNT").length, many.leftOut]).toEqual([MAX_RECORDS, 5]);
    expect(checked(many).at(-1)).toBe("UNCERTAINTY: These are your latest records. Older ones are on the farm's money records page.");
    expect(checked(recordsEvidence({ scope, asOf, records: [records[3]], more: false })[0])).toEqual(["UNCERTAINTY: There are no money records on this farm yet, so there is nothing to show."]);
  });
  it("explain profit: earned, spent and surplus with its margin; a loss is said plainly; not full profit", () => {
    const [evidence] = explainProfitEvidence(money());
    expect(checked(evidence)).toEqual([
      "FACT: For 2026A, money earned was UGX 3000000 and money spent was UGX 2280000, so the recorded surplus is UGX 720000.",
      "FACT: The surplus is 24% of the money earned.",
      "UNCERTAINTY: This is the recorded surplus: money earned less money spent in your records. It is not your full profit: wear on tools and equipment and the cost of loans are not recorded, and stock not yet sold is not counted.",
    ]);
    const loss = explainProfitEvidence(money([dashboard("UGX", "100", "300", "-200", [], [])]))[0];
    expect(checked(loss)[1]).toBe("INFERENCE: More money went out than came in for 2026A, going by these records: UGX -200.");
  });
  it("compare seasons: this season against the one that started just before it, per currency", () => {
    const seasons = [{ seasonId: "s0", label: "2025B", startDate: "2025-08-01", endDate: null }, { seasonId: "s1", label: "2026A", startDate: "2026-03-01", endDate: null }, { seasonId: "s9", label: "2024", startDate: "2024-01-01", endDate: null }];
    expect(earlierSeason(seasons, seasons[1])?.seasonId).toBe("s0");
    expect(earlierSeason(seasons, seasons[2])).toBeNull();
    const before = dashboard("UGX", "2000000", "1500000", "500000", [], []);
    const [evidence] = compareSeasonsEvidence({ scope, basis: "ACCRUAL", asOf, current: { season: seasons[1], currencies: [ugx] }, earlier: { season: seasons[0], currencies: [before, dashboard("USD", "5", "0", "5", [], [])] } });
    expect(checked(evidence)).toEqual([
      "FACT: The recorded surplus was UGX 720000 in 2026A and UGX 500000 in 2025B: a change of UGX 220000.",
      "FACT: Money earned: UGX 3000000 in 2026A, UGX 2000000 in 2025B.",
      "FACT: Money spent: UGX 2280000 in 2026A, UGX 1500000 in 2025B.",
      "UNCERTAINTY: Each season counts only the records linked to it. This is the recorded surplus: money earned less money spent in your records. It is not your full profit: wear on tools and equipment and the cost of loans are not recorded, and stock not yet sold is not counted.",
    ]);
    const usd = compareSeasonsEvidence({ scope, basis: "ACCRUAL", asOf, current: { season: seasons[1], currencies: [ugx] }, earlier: { season: seasons[0], currencies: [before, dashboard("USD", "5", "0", "5", [], [])] } })[1];
    expect([usd.currency, usd.outcome]).toEqual(["USD", { status: "NO_CONCLUSION", reason: "NOT_IN_BOTH_SEASONS" }]);
    const fall = compareSeasonsEvidence({ scope, basis: "ACCRUAL", asOf, current: { season: seasons[1], currencies: [dashboard("UGX", "0", "100", "-100", [], [])] }, earlier: { season: seasons[0], currencies: [before] } })[0];
    expect(checked(fall)[0]).toBe("FACT: The recorded surplus was UGX -100 in 2026A and UGX 500000 in 2025B: a change of UGX -500100.");
    expect(checked(compareSeasonsEvidence({ scope, basis: "ACCRUAL", asOf, current: null, earlier: null })[0])).toEqual(["UNCERTAINTY: Choose one season under \"Which records\" to compare it with the season before it."]);
    expect(checked(compareSeasonsEvidence({ scope, basis: "ACCRUAL", asOf, current: { season: seasons[2], currencies: [] }, earlier: null })[0])).toEqual(["UNCERTAINTY: There is no season before 2024 on this farm, so there is nothing to compare it with."]);
  });
  it("summarize: surplus, the top enterprise and how many enterprises are below zero", () => {
    expect(checked(summarizeEvidence(money())[0]).slice(0, 3)).toEqual([
      "FACT: For 2026A, money earned was UGX 3000000 and money spent was UGX 2280000, so the recorded surplus is UGX 720000.",
      "FACT: Layers house had the highest gross margin: UGX 1420000.",
      "FACT: Enterprises with money records: 3. Of those, enterprises with a gross margin below zero: 1.",
    ]);
  });
  it("farm report: totals, costs by kind and enterprise margins in one answer; it makes no file and links nowhere", () => {
    const [evidence] = farmReportEvidence({ ...money(), costGroups: [{ currency: "UGX", labour: "300000", inputs: "1280000", other: "700000" }] });
    const lines = checked(evidence);
    expect(lines.slice(0, 5)).toEqual([
      "FACT: For 2026A, money earned was UGX 3000000 and money spent was UGX 2280000, so the recorded surplus is UGX 720000.",
      "FACT: Money spent by kind: labour UGX 300000, inputs UGX 1280000, other UGX 700000.",
      "FACT: Layers house: gross margin UGX 1420000.", "FACT: Maize hill: gross margin UGX 300000.", "FACT: Goats: gross margin UGX -1000000.",
    ]);
    expect(lines.at(-1)).toBe("UNCERTAINTY: The assistant does not make files. To download your records, use the money summary or the full farm export on the farm's own pages.");
    expect(lines.join(" ")).not.toMatch(/https?:|\/farms\/|\.csv/);
    const big = farmReportEvidence({ ...money([dashboard("UGX", "1", "1", "0", Array.from({ length: 9 }, (_, i) => line(id(), "Plot " + i, "1", "0", "1")), [])]), costGroups: [] })[0];
    expect([big.labels.length, big.leftOut]).toEqual([MAX_REPORT_ENTERPRISES, 4]);
    expect(checked(big).length).toBeLessThanOrEqual(MAX_STATEMENTS);
  });
  it("unusual costs: only what the approved alert rules flag, with their figures; nothing checked is no conclusion", () => {
    expect(COST_RULE_TITLES).toEqual(Object.fromEntries(Object.keys(COST_RULE_TITLES).map(key => [key, ruleTitles[key as keyof typeof ruleTitles]])));
    const [evidence] = unusualCostsEvidence({ scope, asOf, checked: 3, notJudged: 2, alerts: [
      { insightId: id(), rule: "PRODUCTION_FALLING_COSTS_RISING", subject: "Layers A", subjectId: id(), currency: "UGX", earlier: "1000", current: "1240", change: "24" },
      { insightId: id(), rule: "LOSS_PER_EGG", subject: "Layers B", subjectId: id(), currency: "UGX", costPerUnit: "100", pricePerUnit: "50" },
    ] });
    expect(evidence.period).toBeNull();
    expect(checked(evidence)).toEqual([
      "FACT: Cost alerts open on this farm: 2.",
      "FACT: Fewer eggs while feed costs more, Layers A: feed cost per bird went from UGX 1000 to UGX 1240, a change of 24%.",
      "FACT: Eggs cost more to produce than they sell for, Layers B: it cost UGX 100 for each one, and each sold for UGX 50 on average.",
      "UNCERTAINTY: Cost figures that could not be checked because records are missing: 2. See Alerts for what is missing.",
      "UNCERTAINTY: Unusual here means what the farm's alert rules flag; each rule uses its own period, shown on the Alerts page.",
    ]);
    expect(checked(unusualCostsEvidence({ scope, asOf, checked: 2, notJudged: 0, alerts: [] })[0])[0]).toBe("FACT: No cost alert is open. MyFarm's alert rules checked 2 batches and crops.");
    expect(unusualCostsEvidence({ scope, asOf, checked: 0, notJudged: 0, alerts: [] })[0].outcome).toEqual({ status: "NO_CONCLUSION", reason: "NOTHING_CHECKED" });
    const many = unusualCostsEvidence({ scope, asOf, checked: 9, notJudged: 0, alerts: Array.from({ length: 7 }, () => ({ insightId: id(), rule: "LOSS_PER_KG" as const, subject: "Maize", subjectId: id(), currency: "UGX", costPerUnit: "2", pricePerUnit: "1" })) })[0];
    expect([many.labels.filter(row => row.kind === "SUBJECT").length, many.leftOut]).toEqual([MAX_COST_ALERTS, 2]);
  });
  it("upcoming tasks: work due from today, then work past its date, nearest first and bounded", () => {
    const [evidence] = upcomingTasksEvidence({ scope, asOf, today: "2026-11-13", due: [task("Spraying", "2026-11-14", "Maize hill"), task("Vaccination", "2026-11-20")], missed: [task("Weeding", "2026-11-01", "Maize hill")], moreDue: false, moreMissed: false });
    expect(evidence.period).toEqual({ kind: "DATES", from: "2026-11-13", to: null });
    expect(checked(evidence)).toEqual([
      "FACT: Farm work due from 2026-11-13 and not yet done: 2.",
      "FACT: Spraying for Maize hill, due 2026-11-14.",
      "FACT: Vaccination, due 2026-11-20.",
      "FACT: Work past its date and not marked done: 1.",
      "FACT: Weeding for Maize hill was due on 2026-11-01 and is not marked done.",
    ]);
    const full = upcomingTasksEvidence({ scope, asOf, today: "2026-11-13", due: Array.from({ length: 9 }, (_, i) => task("Feeding", "2026-11-2" + i)), missed: [task("Weeding", "2026-11-01")], moreDue: true, moreMissed: false })[0];
    expect(full.figures.filter(row => row.measure === "DUE_ON").length).toBe(MAX_TASKS);
    expect(full.figures.find(row => row.measure === "DUE")!.value).toBe("9+");
    expect(checked(full).at(-1)).toBe("UNCERTAINTY: Only the nearest work is listed here; see Activities for the rest.");
    expect(checked(upcomingTasksEvidence({ scope, asOf, today: "2026-11-13", due: [], missed: [], moreDue: false, moreMissed: false })[0])).toEqual(["FACT: Farm work due from 2026-11-13 and not yet done: 0."]);
  });
});

describe("stale context, scope and privacy across every tool", () => {
  const all = (): Evidence[] => [
    ...highestProfitEvidence(money()), ...explainProfitEvidence(money()), ...summarizeEvidence(money()), ...farmReportEvidence({ ...money(), costGroups: [] }),
    ...recordsEvidence({ scope, asOf, records, more: false }),
    ...unusualCostsEvidence({ scope, asOf, checked: 1, notJudged: 0, alerts: [{ insightId: id(), rule: "LOSS_PER_BIRD", subject: "Broilers Kato", subjectId: id(), currency: "UGX", costPerUnit: "5000", pricePerUnit: "4000" }] }),
    ...upcomingTasksEvidence({ scope, asOf, today: "2026-11-13", due: [task("Spraying", "2026-11-14", "Maize hill")], missed: [], moreDue: false, moreMissed: false }),
  ];
  it("every evidence names its farm, its tool version and when it was calculated; a later answer never rewrites an earlier one", () => {
    for (const evidence of all()) {
      expect([belongsTo(evidence, scope), belongsTo(evidence, { ...scope, farmId: id() }), evidence.asOf, evidence.toolVersion]).toEqual([true, false, asOf, 1]);
    }
    // Records changed after the first answer: the new evidence has new figures and its own time; the old one is unchanged.
    const first = explainProfitEvidence(money())[0], snapshot = JSON.stringify(first);
    const later = explainProfitEvidence({ ...money([dashboard("UGX", "3100000", "2280000", "820000", [], [], "26.5")]), asOf: "2026-11-14T08:00:00.000Z" })[0];
    expect(said(draftAnswer(later), later)[0]).toContain("UGX 820000");
    expect([JSON.stringify(first), later.asOf]).toEqual([snapshot, "2026-11-14T08:00:00.000Z"]);
  });
  it("no name, label or record ID ever leaves MyFarm, whatever the tool", () => {
    for (const evidence of all()) {
      const sent = JSON.stringify(explainRequest("q", evidence));
      for (const label of evidence.labels) { expect(sent).not.toContain(label.text); if (label.id) expect(sent).not.toContain(label.id); }
      for (const secret of [scope.tenantId, scope.farmId, "2026A"]) expect(sent).not.toContain(secret);
    }
  });
  it("amounts keep their own currency and are never combined; dates are figures, never words", () => {
    for (const evidence of all()) for (const figure of evidence.figures) {
      if (figure.kind === "MONEY") expect(figure.currency).toMatch(/^[A-Z]{3}$/); else expect(figure.currency).toBeNull();
      if (figure.kind === "DATE") expect(figure.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (evidence.currency && figure.kind === "MONEY") expect(figure.currency).toBe(evidence.currency);
    }
  });
});
