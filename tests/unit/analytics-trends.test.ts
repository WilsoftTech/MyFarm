import { describe, expect, it } from "vitest";
import { recognizedEvents, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { batchTrends, cropTrends, trendFigure, type TrendBatchFacts, type TrendCycleFacts, type TrendSeason } from "@/modules/analytics-profitability/domain/trends";

const id = () => crypto.randomUUID();
const value = (text: string) => ({ status: "AVAILABLE", value: text });
const none = (reason: string) => ({ status: "UNAVAILABLE", reason });
const money = (units: bigint) => ({ numerator: units * 10_000n, denominator: 10_000n });
const feed = id(), fertilizer = id(), maize = id(), beans = id(), enterprise = id(), other = id(), s2026 = id(), s2027 = id(), s2028 = id(), chicken = id(), duck = id(), layers = id(), older = id(), newer = id();
const seasons: TrendSeason[] = [{ seasonId: s2026, label: "2026B", startDate: "2026-09-01" }, { seasonId: s2027, label: "2027A", startDate: "2027-03-01" }, { seasonId: s2028, label: "2028A", startDate: "2028-03-01" }];
const record = (kind: RecognitionRecord["kind"], amount: string, links: Partial<RecognitionRecord> = {}): RecognitionRecord => ({ recordId: id(), kind, amount, currency: "UGX", occurredOn: "2027-03-01", status: "POSTED", ...links });
const events = (records: RecognitionRecord[]) => recognizedEvents("ACCRUAL", records, []);
const cycle = (seasonId: string, overrides: Partial<TrendCycleFacts> = {}): TrendCycleFacts => ({ cycleId: id(), seasonId, enterpriseId: enterprise, cropId: maize, cropName: "Maize", areaPlanted: "2", areaUnit: "ACRE", status: "CLOSED", harvestedKg: "1000", lostKg: "0", ...overrides });
const batch = (batchId: string, acquiredOn: string, overrides: Partial<TrendBatchFacts> = {}): TrendBatchFacts => ({ batchId, label: "Batch " + acquiredOn, enterpriseId: layers, animalTypeId: chicken, animalTypeName: "Chicken", acquiredOn, status: "CLOSED", startingQuantity: 100, birdsPurchased: "0", deaths: "0", ...overrides });
const cost = (categoryId: string, amount: string, links: Partial<RecognitionRecord>) => record("EXPENSE", amount, { categoryId, categoryName: categoryId === feed ? "Feed" : "Fertilizer", ...links });

describe("trend variance (MYF-P08-AC003, D-P08-007)", () => {
  it("feed from 100,000 to 118,000 is +18%", () => {
    expect(trendFigure(money(100_000n), money(118_000n)).change).toEqual(value("+18"));
  });
  it("a fall carries its sign, no change is 0, and a tiny rise that rounds away has no sign", () => {
    expect(trendFigure(money(200n), money(189n)).change).toEqual(value("-5.5"));
    expect(trendFigure(money(200n), money(200n)).change).toEqual(value("0"));
    expect(trendFigure(money(100_000n), money(100_001n)).change).toEqual(value("0"));
    expect(trendFigure(money(100n), money(0n)).change).toEqual(value("-100"));
  });
  it("rounds half-up on its size to one decimal", () => {
    expect(trendFigure(money(1000n), money(1125n)).change).toEqual(value("+12.5"));
    expect(trendFigure(money(1600n), money(1500n)).change).toEqual(value("-6.3"));
  });
  it("an absent or zero baseline is not available, never 0 or infinite", () => {
    expect(trendFigure(money(0n), money(118_000n))).toEqual({ earlier: value("0"), current: value("118000"), change: none("NO_BASELINE") });
    expect(trendFigure({ reason: "NO_HARVEST" }, money(5n))).toEqual({ earlier: none("NO_HARVEST"), current: value("5"), change: none("NO_BASELINE") });
    expect(trendFigure(money(0n), money(0n)).change).toEqual(none("NO_BASELINE"));
  });
  it("a current figure that cannot be calculated gives its own reason", () => {
    expect(trendFigure(money(5n), { reason: "NO_HARVEST" })).toEqual({ earlier: value("5"), current: none("NO_HARVEST"), change: none("NO_HARVEST") });
  });
  it("works from exact figures, not from rounded display values", () => {
    // 1/3 and 2/3 show as 0.33 and 0.67; the rounded values would give +103%.
    const figure = trendFigure({ numerator: 1n, denominator: 3n }, { numerator: 2n, denominator: 3n });
    expect(figure).toEqual({ earlier: value("0.33"), current: value("0.67"), change: value("+100") });
  });
});

describe("crops against an earlier season (D-P08-007, D-P08-010)", () => {
  const trend = (cycles: TrendCycleFacts[], records: RecognitionRecord[], seasonId = s2027) => cropTrends(cycles, events(records), seasons, seasonId);
  const figure = (line: ReturnType<typeof trend>[number], name: string, currency = 0) => line.currencies[currency].figures.find(row => row.figure === name);
  it("compares the same crop by acres, kg and category", () => {
    const [line] = trend([cycle(s2026), cycle(s2027, { areaPlanted: "4", harvestedKg: "3000", lostKg: "1000" })], [
      cost(fertilizer, "100000", { enterpriseId: enterprise, seasonId: s2026 }),
      cost(fertilizer, "118000", { enterpriseId: enterprise, seasonId: s2027 }),
      record("SALE", "300000", { enterpriseId: enterprise, seasonId: s2026 }),
      record("SALE", "300000", { enterpriseId: enterprise, seasonId: s2027 }),
    ]);
    expect(line).toMatchObject({ cropName: "Maize", unavailable: null, soFar: false, season: { label: "2027A" }, earlierSeason: { seasonId: s2026, label: "2026B" } });
    expect(line.yieldPerAcre).toEqual({ earlier: value("500"), current: value("750"), change: value("+50") });
    expect(line.currencies[0].categories).toEqual([{ categoryId: fertilizer, name: "Fertilizer", earlier: value("100000"), current: value("118000"), change: value("+18") }]);
    expect(figure(line, "COSTS")).toMatchObject({ change: value("+18") });
    expect(figure(line, "COST_PER_ACRE")).toMatchObject({ earlier: value("50000"), current: value("29500"), change: value("-41") });
    expect(figure(line, "REVENUE_PER_ACRE")).toMatchObject({ earlier: value("150000"), current: value("75000"), change: value("-50") });
    expect(figure(line, "COST_PER_KG")).toMatchObject({ earlier: value("100"), current: value("59"), change: value("-41") });
  });
  it("converts area so a hectare and its acres compare like with like", () => {
    const [line] = trend([cycle(s2026, { areaPlanted: "1", areaUnit: "HECTARE" }), cycle(s2027, { areaPlanted: "10000", areaUnit: "SQUARE_METRE" })], []);
    expect(line.yieldPerAcre?.change).toEqual(value("0"));
  });
  it("uses the most recent earlier season that grew the crop, not later or other seasons", () => {
    const [line] = trend([cycle(s2026, { harvestedKg: "100" }), cycle(s2027, { cropId: beans, cropName: "Beans", enterpriseId: other }), cycle(s2028)], [], s2028);
    expect(line.earlierSeason?.seasonId).toBe(s2026);
    expect(trend([cycle(s2028), cycle(s2027)], [], s2027)[0]).toMatchObject({ unavailable: "NO_EARLIER_SEASON", earlierSeason: null, yieldPerAcre: null, currencies: [] });
  });
  it("never compares different crops", () => {
    const lines = trend([cycle(s2026, { cropId: beans, cropName: "Beans", enterpriseId: other }), cycle(s2027)], []);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ cropName: "Maize", unavailable: "NO_EARLIER_SEASON" });
  });
  it("is not available when either side's enterprise has more than one crop", () => {
    const beansNow = cycle(s2027, { cropId: beans, cropName: "Beans" });
    expect(trend([cycle(s2026), cycle(s2027), beansNow], []).map(line => line.unavailable)).toEqual(["NO_EARLIER_SEASON", "MORE_THAN_ONE_CROP"]);
    expect(trend([cycle(s2026), cycle(s2026, { cropId: beans, cropName: "Beans" }), cycle(s2027)], [])[0]).toMatchObject({ unavailable: "MORE_THAN_ONE_CROP", yieldPerAcre: null, currencies: [] });
  });
  it("adds every enterprise growing the crop in a season", () => {
    const [line] = trend([cycle(s2026), cycle(s2027), cycle(s2027, { enterpriseId: other })], [
      record("EXPENSE", "100", { enterpriseId: enterprise, seasonId: s2026 }), record("EXPENSE", "100", { enterpriseId: enterprise, seasonId: s2027 }), record("EXPENSE", "20", { enterpriseId: other, seasonId: s2027 }),
    ]);
    expect(figure(line, "COSTS")?.current).toEqual(value("120"));
    expect(line.yieldPerAcre).toMatchObject({ earlier: value("500"), current: value("500"), change: value("0") });
  });
  it("keeps currencies apart: a currency with no baseline has no percentage", () => {
    const [line] = trend([cycle(s2026), cycle(s2027)], [record("EXPENSE", "100", { enterpriseId: enterprise, seasonId: s2026 }), record("EXPENSE", "110", { enterpriseId: enterprise, seasonId: s2027 }), record("EXPENSE", "50", { enterpriseId: enterprise, seasonId: s2027, currency: "USD" })]);
    expect(line.currencies.map(row => row.currency)).toEqual(["UGX", "USD"]);
    expect(figure(line, "COSTS", 0)?.change).toEqual(value("+10"));
    expect(figure(line, "COSTS", 1)).toMatchObject({ earlier: value("0"), current: value("50"), change: none("NO_BASELINE") });
  });
  it("says why when there is no harvest or no area on a side", () => {
    const [noCrop] = trend([cycle(s2026, { harvestedKg: "0" }), cycle(s2027)], [record("EXPENSE", "10", { enterpriseId: enterprise, seasonId: s2027 })]);
    expect(noCrop.yieldPerAcre).toMatchObject({ earlier: none("NO_HARVEST"), change: none("NO_BASELINE") });
    expect(figure(noCrop, "COST_PER_KG")).toMatchObject({ earlier: none("NO_HARVEST"), change: none("NO_BASELINE") });
    const [noNow] = trend([cycle(s2026), cycle(s2027, { harvestedKg: "0" })], [record("EXPENSE", "10", { enterpriseId: enterprise, seasonId: s2027 })]);
    expect(noNow.yieldPerAcre).toMatchObject({ current: none("NO_HARVEST"), change: none("NO_HARVEST") });
    const [noArea] = trend([cycle(s2026), cycle(s2027, { areaPlanted: "0" })], [record("EXPENSE", "10", { enterpriseId: enterprise, seasonId: s2026 })]);
    expect(figure(noArea, "COST_PER_ACRE")).toMatchObject({ current: none("NO_AREA"), change: none("NO_AREA") });
  });
  it("names costs that could belong here on either side, and leaves other money out", () => {
    const [line] = trend([cycle(s2026), cycle(s2027)], [
      record("EXPENSE", "100", { enterpriseId: enterprise, seasonId: s2026 }), record("EXPENSE", "100", { enterpriseId: enterprise, seasonId: s2027 }),
      record("EXPENSE", "7", { enterpriseId: enterprise }), record("EXPENSE", "20", { seasonId: s2027 }), record("EXPENSE", "30", { seasonId: s2026 }),
      record("EXPENSE", "999", { enterpriseId: other, seasonId: s2027 }), record("EXPENSE", "999"),
    ]);
    expect(line.currencies[0].notLinked).toEqual({ current: "27", earlier: "37" });
    expect(figure(line, "COSTS")).toMatchObject({ earlier: value("100"), current: value("100") });
  });
  it("still warns in a currency with only unlinked costs", () => {
    const [line] = trend([cycle(s2026), cycle(s2027)], [record("EXPENSE", "7", { enterpriseId: enterprise, currency: "USD" })]);
    expect(line.currencies.map(row => [row.currency, row.notLinked])).toEqual([["USD", { current: "7", earlier: "7" }]]);
  });
  it("labels the comparison so far when either side is still open", () => {
    expect(trend([cycle(s2026, { status: "ACTIVE" }), cycle(s2027)], [])[0].soFar).toBe(true);
    expect(trend([cycle(s2026), cycle(s2027, { status: "ACTIVE" })], [])[0].soFar).toBe(true);
  });
  it("leaves out reversed records and has nothing for a season it does not know", () => {
    const [line] = trend([cycle(s2026), cycle(s2027)], [record("EXPENSE", "100", { enterpriseId: enterprise, seasonId: s2026 }), record("EXPENSE", "500", { enterpriseId: enterprise, seasonId: s2027, status: "REVERSED" })]);
    expect(figure(line, "COSTS")).toMatchObject({ current: value("0"), change: value("-100") });
    expect(trend([cycle(s2027)], [], id())).toEqual([]);
  });
});

describe("batches against an earlier batch (D-P08-006, D-P08-007)", () => {
  const costs = (batchId: string, categoryId: string, amount: string) => cost(categoryId, amount, { batchId, enterpriseId: layers });
  it("feed spending up 18% compared with the previous batch", () => {
    const [newest] = batchTrends([batch(newer, "2027-06-01", { birdsPurchased: "18" }), batch(older, "2027-01-01")], events([costs(older, feed, "100000"), costs(newer, feed, "118000"), record("SALE", "50000", { batchId: older, enterpriseId: layers }), record("SALE", "118000", { batchId: newer, enterpriseId: layers })]));
    expect(newest).toMatchObject({ unavailable: null, earlierBatch: { batchId: older }, soFar: false });
    expect(newest.currencies[0].categories).toEqual([{ categoryId: feed, name: "Feed", earlier: value("100000"), current: value("118000"), change: value("+18") }]);
    expect(newest.currencies[0].figures).toEqual([
      { figure: "COSTS", earlier: value("100000"), current: value("118000"), change: value("+18") },
      { figure: "COST_PER_BIRD", earlier: value("1000"), current: value("1000"), change: value("0") },
      { figure: "REVENUE_PER_BIRD", earlier: value("500"), current: value("1000"), change: value("+100") },
    ]);
  });
  it("the oldest batch, and a batch of another animal, have nothing to compare with", () => {
    const lines = batchTrends([batch(newer, "2027-06-01", { animalTypeId: duck, animalTypeName: "Duck" }), batch(older, "2027-01-01")], []);
    expect(lines.map(line => line.unavailable)).toEqual(["NO_EARLIER_BATCH", "NO_EARLIER_BATCH"]);
    expect(lines[0]).toMatchObject({ earlierBatch: null, currencies: [] });
  });
  it("two batches started on one day are not earlier than each other", () => {
    expect(batchTrends([batch(newer, "2027-01-01"), batch(older, "2027-01-01")], []).map(line => line.unavailable)).toEqual(["NO_EARLIER_BATCH", "NO_EARLIER_BATCH"]);
  });
  it("uses the most recent earlier batch", () => {
    const middle = id();
    const [line] = batchTrends([batch(newer, "2027-06-01"), batch(middle, "2027-03-01"), batch(older, "2027-01-01")], []);
    expect(line.earlierBatch?.batchId).toBe(middle);
  });
  it("a batch with no birds says why instead of dividing by nothing", () => {
    const [line] = batchTrends([batch(newer, "2027-06-01", { startingQuantity: 0 }), batch(older, "2027-01-01")], events([costs(older, feed, "10"), costs(newer, feed, "10")]));
    expect(line.currencies[0].figures.find(row => row.figure === "COST_PER_BIRD")).toMatchObject({ current: none("NO_BIRDS"), change: none("NO_BIRDS") });
  });
  it("names unlinked costs of either batch's enterprise, even with nothing linked yet", () => {
    const flock2 = id();
    const [line] = batchTrends([batch(newer, "2027-06-01"), batch(older, "2027-01-01", { enterpriseId: flock2 })], events([record("EXPENSE", "5", { enterpriseId: layers }), record("EXPENSE", "9", { enterpriseId: flock2 })]));
    expect(line.currencies).toHaveLength(1);
    expect(line.currencies[0].notLinked).toEqual({ current: "5", earlier: "9" });
  });
  it("a batch cut off by the screen's limit is still a baseline, but gets no line of its own (P8-C4)", () => {
    const lines = batchTrends([batch(newer, "2027-06-01")], events([costs(older, feed, "100000"), costs(newer, feed, "118000")]), [batch(older, "2027-01-01")]);
    expect(lines.map(line => line.batchId)).toEqual([newer]);
    expect(lines[0]).toMatchObject({ earlierBatch: { batchId: older }, unavailable: null });
    expect(lines[0].currencies[0].categories[0].change).toEqual(value("+18"));
  });
  it("labels the comparison so far when either batch is active", () => {
    expect(batchTrends([batch(newer, "2027-06-01", { status: "ACTIVE" }), batch(older, "2027-01-01")], [])[0].soFar).toBe(true);
    expect(batchTrends([batch(newer, "2027-06-01"), batch(older, "2027-01-01", { status: "ACTIVE" })], [])[0].soFar).toBe(true);
  });
});
