import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
import type { BatchEntry } from "@/modules/farm-intelligence/domain/batch-trends";
import { evaluateFeedStock, evaluateHighMortality, evaluateUnitLoss, lossWindow, thresholdCandidates, type MortalityFacts } from "@/modules/farm-intelligence/domain/thresholds";
import { decideInsight, isWorse } from "@/modules/farm-intelligence/domain/insight-state";
import { RULES } from "@/modules/farm-intelligence/domain/rules";
import { thresholdEvidenceOf, thresholdEvidenceSchema } from "@/modules/farm-intelligence/contracts/insights";

// Farm date 2026-11-11: last 7 days 2026-11-04..2026-11-10; last 14 days 2026-10-28..2026-11-10; last 28 days 2026-10-14..2026-11-10.
const today = "2026-11-11";
const days = (from: string, count: number) => Array.from({ length: count }, (_, index) => addDays(from, index));
const entry = (type: BatchEntry["type"], quantity: string, unit: string, occurredOn: string): BatchEntry => ({ type, quantity, unit, occurredOn });
const fed = (from: string, count: number) => days(from, count).map(day => entry("FEED", "50", "KG", day));
const flock = (overrides: Partial<MortalityFacts> = {}): MortalityFacts => ({ batchId: "b0000000-0000-4000-8000-000000000001", label: "Layers A", startingQuantity: 500, acquiredOn: "2026-08-01", entries: fed("2026-11-04", 7), ...overrides });
const subject = { kind: "BATCH" as const, id: "b0000000-0000-4000-8000-000000000001", label: "Layers A" };

describe("MYF-P10-R002 high mortality (D-P10-003)", () => {
  it("is raised above 1% of the birds at risk in the last 7 complete days, not at exactly 1%", () => {
    const at = (count: string) => evaluateHighMortality(flock({ entries: [...fed("2026-11-04", 7), entry("MORTALITY", count, "BIRD", "2026-11-06")] }), today);
    expect(at("5")).toMatchObject({ outcome: "NOT_RAISED", window: { from: "2026-11-04", to: "2026-11-10" }, values: { deaths: "5", birdsAtRisk: "500", rate: "1", recordedDays: "7" } });
    expect(at("6")).toMatchObject({ outcome: "RAISED", values: { rate: "1.2" } });
    expect(thresholdCandidates(subject, [at("6")]).map(row => [row.ruleKey, row.severity, row.ruleVersion])).toEqual([["HIGH_MORTALITY", "WARNING", 1]]);
  });
  it("counts birds bought in the week as at risk, and earlier deaths only through the flock size", () => {
    const facts = flock({ entries: [entry("MORTALITY", "100", "BIRD", "2026-10-01"), ...fed("2026-11-04", 7), entry("PURCHASE", "100", "BIRD", "2026-11-05"), entry("MORTALITY", "5", "BIRD", "2026-11-08")] });
    expect(evaluateHighMortality(facts, today).values).toMatchObject({ birdsAtRisk: "500", rate: "1" });
  });
  it("is not judged on thin records, a small flock or a batch younger than a week", () => {
    expect(evaluateHighMortality(flock({ entries: fed("2026-11-04", 3) }), today)).toMatchObject({ outcome: "NOT_ENOUGH_RECORDS", missing: ["FEW_RECORDED_DAYS"] });
    expect(evaluateHighMortality(flock({ startingQuantity: 19 }), today).missing).toEqual(["TOO_FEW_BIRDS"]);
    expect(evaluateHighMortality(flock({ acquiredOn: "2026-11-06" }), today).missing).toEqual(["BATCH_TOO_YOUNG"]);
  });
});

describe("MYF-P10-R002 feed running low (D-P10-005, D-P10-007)", () => {
  const item = (balance: string, unit = "KG") => ({ itemId: "i", name: "Layer mash", unit, balance });
  const own = fed("2026-10-28", 14);
  it("is raised when stock covers fewer than 7 days at the last 14 days' use; exactly 7 is not raised", () => {
    expect(evaluateFeedStock({ item: item("700"), entries: own, sharedUseKg: "1400" }, today)).toMatchObject({ outcome: "NOT_RAISED", window: { from: "2026-10-28", to: "2026-11-10" },
      values: { itemName: "Layer mash", stockKg: "700", dailyUseKg: "100", daysLeft: "7", feedDays: "7, 7" } });
    expect(evaluateFeedStock({ item: item("699.999999"), entries: own, sharedUseKg: "1400" }, today)).toMatchObject({ outcome: "RAISED", values: { daysLeft: "7" } });
    expect(evaluateFeedStock({ item: item("0"), entries: own, sharedUseKg: "1400" }, today)).toMatchObject({ outcome: "RAISED", values: { daysLeft: "0" } });
  });
  it("adds the use of every batch fed from the same item", () => {
    expect(evaluateFeedStock({ item: item("1000"), entries: own, sharedUseKg: "700" }, today).outcome).toBe("NOT_RAISED");
    expect(evaluateFeedStock({ item: item("1000"), entries: own, sharedUseKg: "2100" }, today)).toMatchObject({ outcome: "RAISED", values: { dailyUseKg: "150", daysLeft: "6.7" } });
  });
  it("needs a chosen feed item in kg, feed given on 4 days of each week, and some use: wrong units and missing demand are not guessed", () => {
    expect(evaluateFeedStock({ item: null, entries: own, sharedUseKg: "1400" }, today).missing).toEqual(["NO_FEED_ITEM"]);
    expect(evaluateFeedStock({ item: item("10", "BAG"), entries: own, sharedUseKg: "1400" }, today).missing).toEqual(["FEED_ITEM_NOT_KG"]);
    expect(evaluateFeedStock({ item: item("10"), entries: fed("2026-10-28", 10), sharedUseKg: "500" }, today)).toMatchObject({ missing: ["FEW_FEED_DAYS"], values: {} });
    expect(evaluateFeedStock({ item: item("10"), entries: own, sharedUseKg: "0" }, today).missing).toEqual(["NO_FEED_USE"]);
  });
});

describe("MYF-P10-R002 loss: cost per unit against the price per unit sold (D-P10-005)", () => {
  const window = lossWindow(today);
  const ugx = (amount: string, occurredOn = "2026-10-20", currency = "UGX") => ({ amount, currency, occurredOn });
  const sale = (amount: string, quantity: string, occurredOn = "2026-10-25", currency = "UGX") => ({ amount, currency, quantity, occurredOn });
  it("eggs: 200 UGX to produce and 200 UGX to sell is not a loss; a shilling less on the sales is", () => {
    const eggs = (amount: string) => evaluateUnitLoss({ rule: "LOSS_PER_EGG", window, produced: "10000", costs: [ugx("2000000")], sales: [sale(amount, "5000")] });
    expect(window).toEqual({ from: "2026-10-14", to: "2026-11-10" });
    expect(eggs("1000000")).toEqual([expect.objectContaining({ outcome: "NOT_RAISED", currency: "UGX", values: { costs: "2000000", produced: "10000", costPerUnit: "200", sales: "1000000", sold: "5000", pricePerUnit: "200" } })]);
    expect(eggs("999999")[0]).toMatchObject({ outcome: "RAISED", values: { pricePerUnit: "200" } });
  });
  it("only counts costs and sales inside the window, and compares one currency at a time", () => {
    const result = evaluateUnitLoss({ rule: "LOSS_PER_EGG", window, produced: "10000", costs: [ugx("2000000"), ugx("9000000", "2026-09-01")], sales: [sale("1000000", "5000"), sale("50", "100", "2026-10-30", "USD")] });
    expect(result.map(row => [row.currency, row.outcome, row.values.costs ?? null])).toEqual([["UGX", "NOT_RAISED", "2000000"], ["USD", "NOT_RAISED", "0"]]);
    expect(evaluateUnitLoss({ rule: "LOSS_PER_EGG", window, produced: "10000", costs: [ugx("2000000")], sales: [sale("50", "100", "2026-10-30", "USD")] })
      .map(row => [row.currency, row.outcome, row.missing])).toEqual([["UGX", "NOT_ENOUGH_RECORDS", ["NO_SALES"]], ["USD", "NOT_RAISED", []]]);
  });
  it("crop: the Phase 8 example's 560 UGX per kg against sales at 550 UGX per kg is a loss", () => {
    const [crop] = evaluateUnitLoss({ rule: "LOSS_PER_KG", window: null, produced: "3750", costs: [ugx("2100000", "2027-03-10")], sales: [sale("550000", "1000", "2027-07-15")] });
    expect(crop).toMatchObject({ outcome: "RAISED", window: null, values: { costPerUnit: "560", pricePerUnit: "550" } });
    expect(evaluateUnitLoss({ rule: "LOSS_PER_KG", window: null, produced: "3750", costs: [], sales: [], blocked: "MORE_THAN_ONE_CROP" })[0].missing).toEqual(["MORE_THAN_ONE_CROP"]);
  });
  it("says what is missing: nothing produced, nothing sold", () => {
    expect(evaluateUnitLoss({ rule: "LOSS_PER_BIRD", window: null, produced: "0", costs: [], sales: [] })[0].missing).toEqual(["NO_PRODUCTION", "NO_SALES"]);
    expect(evaluateUnitLoss({ rule: "LOSS_PER_BIRD", window: null, produced: "500", costs: [ugx("100")], sales: [] })[0].missing).toEqual(["NO_SALES"]);
    expect(evaluateUnitLoss({ rule: "LOSS_PER_EGG", window, produced: "0", costs: [ugx("100")], sales: [sale("100", "10")] })[0].missing).toEqual(["NO_PRODUCTION"]);
    expect(() => evaluateUnitLoss({ rule: "LOSS_PER_EGG", window, produced: "10", costs: [ugx("-1")], sales: [] })).toThrow("INVALID_INPUT");
  });
});

describe("threshold evidence and repeats", () => {
  it("stores the figure, its window, inputs and rule version, and refuses anything else", () => {
    const figure = evaluateHighMortality(flock({ entries: [...fed("2026-11-04", 7), entry("MORTALITY", "6", "BIRD", "2026-11-06")] }), today);
    const evidence = thresholdEvidenceOf(thresholdCandidates(subject, [figure])[0]);
    expect(thresholdEvidenceSchema.parse(JSON.parse(JSON.stringify(evidence)))).toEqual(evidence);
    expect(evidence).toMatchObject({ evidenceVersion: 1, kind: "THRESHOLD", subject: { kind: "BATCH", label: "Layers A" }, figure: { rule: "HIGH_MORTALITY", values: { rate: "1.2" } } });
    expect(() => thresholdEvidenceSchema.parse({ ...evidence, figure: { ...evidence.figure, rule: "SOMETHING_ELSE" } })).toThrow();
    expect(RULES.HIGH_MORTALITY.decisions).toContain("D-P10-003");
  });
  it("fewer days of feed left is worse; more deaths, or cost further above price, is worse", () => {
    const low = (numerator: string) => [{ rule: "FEED_RUNNING_LOW" as const, exactChange: { numerator, denominator: "1" } }];
    expect(isWorse(low("5"), low("3"))).toBe(true);
    expect(isWorse(low("3"), low("5"))).toBe(false);
    const raised = { judged: true, candidate: { figures: low("3") } };
    expect(decideInsight({ status: "ACKNOWLEDGED", figures: low("5") }, raised)).toBe("CREATE");
    expect(decideInsight({ status: "ACKNOWLEDGED", figures: low("2") }, raised)).toBe("NONE");
    const loss = (numerator: string) => [{ rule: "LOSS_PER_EGG" as const, exactChange: { numerator, denominator: "100" } }];
    expect(isWorse(loss("101"), loss("110"))).toBe(true);
  });
});

describe("no LLM or network in the rules (P0598)", () => {
  it("the farm-intelligence domain and contracts import nothing that could call a model or the network", () => {
    const root = "src/modules/farm-intelligence";
    const files = ["domain", "contracts"].flatMap(folder => readdirSync(join(root, folder)).map(file => join(root, folder, file)));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const file of files) expect(readFileSync(file, "utf8"), file).not.toMatch(/\bfetch\(|openai|anthropic|@ai-sdk|langchain|gemini|XMLHttpRequest|node:http/i);
  });
});
