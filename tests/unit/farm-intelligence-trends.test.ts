import { describe, expect, it } from "vitest";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
import { evaluateBatchTrends, trendWindows, type BatchEntry, type BatchTrendFacts, type FeedCost, type TrendFigure } from "@/modules/farm-intelligence/domain/batch-trends";
import { decideInsight, isWorse, subjectOutcomes, type LatestInsight } from "@/modules/farm-intelligence/domain/insight-state";
import { RULES } from "@/modules/farm-intelligence/domain/rules";
import { evidenceOf, insightEvidenceSchema } from "@/modules/farm-intelligence/contracts/insights";

// Farm date 2026-11-11: current window 2026-10-14..2026-11-10, earlier window 2026-09-16..2026-10-13.
const today = "2026-11-11";
const days = (from: string, count: number) => Array.from({ length: count }, (_, index) => addDays(from, index));
const earlierDays = days("2026-09-16", 28), currentDays = days("2026-10-14", 28);
const eggs = (occurredOn: string, count: number): BatchEntry => ({ type: "EGGS", quantity: String(count), unit: "EGG", occurredOn });
const deaths = (occurredOn: string, count: number): BatchEntry => ({ type: "MORTALITY", quantity: String(count), unit: "BIRD", occurredOn });
const fed = (occurredOn: string): BatchEntry => ({ type: "FEED", quantity: "55.5", unit: "KG", occurredOn });
const ugx = (occurredOn: string, amount: string, currency = "UGX"): FeedCost => ({ amount, currency, occurredOn });
const batch = (overrides: Partial<BatchTrendFacts> = {}): BatchTrendFacts =>
  ({ batchId: "b0000000-0000-4000-8000-000000000001", label: "Layers A", status: "ACTIVE", startingQuantity: 500, acquiredOn: "2026-08-01", entries: [], feedCosts: [], ...overrides });
const figure = (figures: TrendFigure[], rule: TrendFigure["rule"], currency: string | null = null) => figures.find(item => item.rule === rule && item.currency === currency)!;

/** The source's example (P0580-P0587): feed cost +24%, eggs -12%, and deaths rising by more than a point. */
function golden(): BatchTrendFacts {
  return batch({
    entries: [
      ...earlierDays.map(day => eggs(day, 400)), deaths("2026-10-13", 5),
      // 13 days of 349 and 15 of 348: 9,757 eggs from 495 birds.
      ...currentDays.map((day, index) => eggs(day, index < 13 ? 349 : 348)), deaths("2026-11-10", 12),
    ],
    feedCosts: [ugx("2026-09-20", "250000"), ugx("2026-10-04", "250000"), ugx("2026-10-18", "306900"), ugx("2026-11-01", "306900")],
  });
}

describe("MYF-P10-R001 batch trends (D-P10-002, D-P10-004, D-P10-006)", () => {
  it("compares the last 28 complete farm days with the 28 before them", () => {
    expect(trendWindows(today)).toEqual({ earlier: { from: "2026-09-16", to: "2026-10-13" }, current: { from: "2026-10-14", to: "2026-11-10" } });
  });

  it("golden: feed +24%, eggs -12% and deaths +1.4 points raise the combined warning and a mortality watch", () => {
    const result = evaluateBatchTrends(golden(), today)!;
    expect(figure(result.figures, "FEED_COST_RISING", "UGX")).toMatchObject({ outcome: "RAISED", earlier: "1000", current: "1240", change: "24", missing: [] });
    expect(figure(result.figures, "EGGS_FALLING")).toMatchObject({ outcome: "RAISED", earlier: "80", current: "70.4", change: "-12" });
    expect(figure(result.figures, "MORTALITY_RISING")).toMatchObject({ outcome: "RAISED", earlier: "1", current: "2.4", change: "1.4" });
    expect(result.candidates.map(item => [item.ruleKey, item.severity, item.currency, item.ruleVersion])).toEqual([
      ["PRODUCTION_FALLING_COSTS_RISING", "WARNING", "UGX", 1], ["MORTALITY_RISING", "WATCH", null, 1],
    ]);
    expect(result.coverage).toEqual({
      earlier: { birdsAtStart: "500", recordedDays: [7, 7, 7, 7], eggDays: [7, 7, 7, 7] },
      current: { birdsAtStart: "495", recordedDays: [7, 7, 7, 7], eggDays: [7, 7, 7, 7] },
    });
  });

  it("AC001: the stored evidence carries the values, both windows, the rule version and the coverage", () => {
    const result = evaluateBatchTrends(golden(), today)!;
    const evidence = evidenceOf(result, result.candidates[0]);
    expect(insightEvidenceSchema.parse(JSON.parse(JSON.stringify(evidence)))).toEqual(evidence);
    expect(evidence).toMatchObject({ evidenceVersion: 1, batchLabel: "Layers A", windows: result.windows, coverage: result.coverage });
    expect(evidence.figures.map(item => item.rule)).toEqual(["FEED_COST_RISING", "EGGS_FALLING"]);
    expect(RULES.PRODUCTION_FALLING_COSTS_RISING.decisions).toContain("D-P10-002");
    expect(() => insightEvidenceSchema.parse({ ...evidence, evidenceVersion: 2 })).toThrow();
  });

  it("sparse egg records suppress the egg figure, so a rising feed cost is raised alone", () => {
    const facts = golden();
    // Eggs on only 3 days of the second current block; feed is still given every day.
    const thin = facts.entries.filter(entry => !(entry.type === "EGGS" && entry.occurredOn >= "2026-10-21" && entry.occurredOn <= "2026-10-24"));
    const result = evaluateBatchTrends({ ...facts, entries: [...thin, ...[...earlierDays, ...currentDays].map(fed)] }, today)!;
    expect(figure(result.figures, "EGGS_FALLING")).toMatchObject({ outcome: "NOT_ENOUGH_RECORDS", missing: ["FEW_EGG_DAYS"], change: null, exactChange: null });
    expect(result.coverage.current.eggDays).toEqual([7, 3, 7, 7]);
    expect(result.candidates.map(item => item.ruleKey)).toEqual(["FEED_COST_RISING", "MORTALITY_RISING"]);
  });

  it("fewer than 4 recorded days in any block suppresses feed and mortality as well", () => {
    const facts = golden();
    const result = evaluateBatchTrends({ ...facts, entries: facts.entries.filter(entry => entry.occurredOn < "2026-09-23" || entry.occurredOn > "2026-09-26") }, today)!;
    expect(result.coverage.earlier.recordedDays).toEqual([7, 3, 7, 7]);
    for (const rule of ["FEED_COST_RISING", "MORTALITY_RISING"] as const) expect(figure(result.figures, rule, rule === "FEED_COST_RISING" ? "UGX" : null)).toMatchObject({ outcome: "NOT_ENOUGH_RECORDS", missing: ["FEW_RECORDED_DAYS"] });
    expect(result.candidates).toEqual([]);
  });

  it("a recorded day without deaths counts as zero deaths", () => {
    const result = evaluateBatchTrends(batch({ entries: [...earlierDays, ...currentDays].map(fed) }), today)!;
    expect(figure(result.figures, "MORTALITY_RISING")).toMatchObject({ outcome: "NOT_RAISED", earlier: "0", current: "0", change: "0" });
  });

  describe("thresholds are inclusive and compared exactly", () => {
    const flat = (current: (day: string, index: number) => BatchEntry[], costs: FeedCost[] = []) =>
      evaluateBatchTrends(batch({ entries: [...earlierDays.map(day => eggs(day, 400)), ...currentDays.flatMap(current)], feedCosts: costs }), today)!;
    it("feed cost: +20% exactly is raised, a hair below is not", () => {
      const daily = (day: string) => [eggs(day, 400)];
      expect(figure(flat(daily, [ugx("2026-09-20", "500000"), ugx("2026-10-20", "600000")]).figures, "FEED_COST_RISING", "UGX")).toMatchObject({ outcome: "RAISED", change: "20" });
      expect(figure(flat(daily, [ugx("2026-09-20", "500000"), ugx("2026-10-20", "599999.9999")]).figures, "FEED_COST_RISING", "UGX")).toMatchObject({ outcome: "NOT_RAISED", change: "20" });
    });
    it("eggs: -10% exactly is raised, one egg more is not", () => {
      expect(figure(flat(day => [eggs(day, 360)]).figures, "EGGS_FALLING")).toMatchObject({ outcome: "RAISED", change: "-10" });
      expect(figure(flat((day, index) => [eggs(day, index === 0 ? 361 : 360)]).figures, "EGGS_FALLING")).toMatchObject({ outcome: "NOT_RAISED", change: "-10" });
    });
    it("mortality: +1 point exactly is raised, 0.8 points is not", () => {
      expect(figure(flat((day, index) => [eggs(day, 400), ...(index === 27 ? [deaths(day, 5)] : [])]).figures, "MORTALITY_RISING")).toMatchObject({ outcome: "RAISED", current: "1", change: "1" });
      expect(figure(flat((day, index) => [eggs(day, 400), ...(index === 27 ? [deaths(day, 4)] : [])]).figures, "MORTALITY_RISING")).toMatchObject({ outcome: "NOT_RAISED", change: "0.8" });
    });
  });

  it("a batch under 20 birds, or younger than both windows, is not judged", () => {
    const entries = [...earlierDays, ...currentDays].map(day => eggs(day, 10));
    for (const figureResult of evaluateBatchTrends(batch({ startingQuantity: 19, entries }), today)!.figures) expect(figureResult.missing).toContain("TOO_FEW_BIRDS");
    const young = evaluateBatchTrends(batch({ acquiredOn: "2026-10-01", entries: currentDays.map(day => eggs(day, 400)) }), today)!;
    for (const figureResult of young.figures) expect(figureResult).toMatchObject({ outcome: "NOT_ENOUGH_RECORDS", missing: ["BATCH_TOO_YOUNG"] });
    expect(young.coverage.earlier.birdsAtStart).toBe("0");
  });

  it("money is compared within one currency only", () => {
    const facts = golden();
    const result = evaluateBatchTrends({ ...facts, feedCosts: [...facts.feedCosts, ugx("2026-10-20", "90", "USD")] }, today)!;
    expect(figure(result.figures, "FEED_COST_RISING", "USD")).toMatchObject({ outcome: "NOT_ENOUGH_RECORDS", missing: ["NO_FEED_COST"] });
    expect(figure(result.figures, "FEED_COST_RISING", "UGX")).toMatchObject({ outcome: "RAISED", change: "24" });
    const none = evaluateBatchTrends({ ...facts, feedCosts: [] }, today)!;
    expect(figure(none.figures, "FEED_COST_RISING", null)).toMatchObject({ outcome: "NOT_ENOUGH_RECORDS", missing: ["NO_FEED_COST"] });
  });

  it("a batch without eggs (broilers) gives no egg figure but still judges deaths", () => {
    const result = evaluateBatchTrends(batch({ entries: [...earlierDays, ...currentDays].map(fed) }), today)!;
    expect(figure(result.figures, "EGGS_FALLING").missing).toEqual(["FEW_EGG_DAYS", "NO_EARLIER_EGGS"]);
    expect(figure(result.figures, "MORTALITY_RISING").outcome).toBe("NOT_RAISED");
  });

  it("a closed batch has no current trend; bad input is refused rather than guessed", () => {
    expect(evaluateBatchTrends({ ...golden(), status: "CLOSED" }, today)).toBeNull();
    expect(() => evaluateBatchTrends(golden(), "2026-02-30")).toThrow("INVALID_INPUT");
    expect(() => evaluateBatchTrends(batch({ entries: [{ type: "EGGS", quantity: "1.5", unit: "EGG", occurredOn: "2026-10-20" }] }), today)).toThrow("INVALID_INPUT");
    expect(() => evaluateBatchTrends(batch({ feedCosts: [ugx("2026-10-20", "-1")] }), today)).toThrow("INVALID_INPUT");
    expect(() => evaluateBatchTrends(batch({ startingQuantity: 5, entries: [deaths("2026-10-01", 6)] }), today)).toThrow("CONFLICT");
  });

  it("is deterministic: the same records on the same farm date give the same result", () => {
    expect(evaluateBatchTrends(golden(), today)).toEqual(evaluateBatchTrends(golden(), today));
  });
});

describe("repeats and acknowledgement (D-P10-004)", () => {
  const evaluation = evaluateBatchTrends(golden(), today)!;
  const outcomes = subjectOutcomes(evaluation);
  const outcome = (ruleKey: string) => outcomes.find(item => item.ruleKey === ruleKey)!;
  const stored = (status: LatestInsight["status"], change: { numerator: string; denominator: string }): LatestInsight => ({ status, figures: [{ rule: "MORTALITY_RISING", exactChange: change }] });
  const mortality = figure(evaluation.figures, "MORTALITY_RISING").exactChange!;

  it("lists every subject the evaluation can speak about", () => {
    expect(outcomes.map(item => [item.ruleKey, item.currency, item.judged, item.candidate?.ruleKey ?? null])).toEqual([
      ["FEED_COST_RISING", "UGX", true, null], ["PRODUCTION_FALLING_COSTS_RISING", "UGX", true, "PRODUCTION_FALLING_COSTS_RISING"],
      ["EGGS_FALLING", null, true, null], ["MORTALITY_RISING", null, true, "MORTALITY_RISING"],
    ]);
  });
  it("raises a new insight once, and not again while it is open", () => {
    expect(decideInsight(null, outcome("MORTALITY_RISING"))).toBe("CREATE");
    expect(decideInsight(stored("OPEN", mortality), outcome("MORTALITY_RISING"))).toBe("NONE");
    expect(decideInsight(stored("CLEARED", mortality), outcome("MORTALITY_RISING"))).toBe("CREATE");
  });
  it("after acknowledgement, comes back only when the figure is worse", () => {
    expect(decideInsight(stored("ACKNOWLEDGED", mortality), outcome("MORTALITY_RISING"))).toBe("NONE");
    expect(decideInsight(stored("ACKNOWLEDGED", { numerator: "1", denominator: "1" }), outcome("MORTALITY_RISING"))).toBe("CREATE");
    expect(decideInsight(stored("ACKNOWLEDGED", { numerator: "2", denominator: "1" }), outcome("MORTALITY_RISING"))).toBe("NONE");
    const eggs = figure(evaluation.figures, "EGGS_FALLING");
    expect(isWorse([{ rule: "EGGS_FALLING", exactChange: { numerator: "-1", denominator: "10" } }], [eggs])).toBe(true);
    expect(isWorse([{ rule: "EGGS_FALLING", exactChange: { numerator: "-13", denominator: "100" } }], [eggs])).toBe(false);
  });
  it("clears a live insight when the condition is judged gone, and changes nothing when records are too thin", () => {
    expect(decideInsight(stored("OPEN", mortality), outcome("EGGS_FALLING"))).toBe("CLEAR");
    expect(decideInsight(stored("ACKNOWLEDGED", mortality), outcome("FEED_COST_RISING"))).toBe("CLEAR");
    expect(decideInsight(null, outcome("EGGS_FALLING"))).toBe("NONE");
    expect(decideInsight(stored("OPEN", mortality), { ...outcome("MORTALITY_RISING"), judged: false, candidate: null })).toBe("NONE");
  });
});
