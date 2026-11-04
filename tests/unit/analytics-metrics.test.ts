import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { recognizedEvents, type RecognitionRecord } from "@/modules/farm-accounting/domain/accounting";
import { batchMetrics, costGroupTotals, cropMetrics, stockValue, type BatchFacts, type CostGroup, type CropCycleFacts, type StockItemFacts } from "@/modules/analytics-profitability/domain/metrics";

const id = () => crypto.randomUUID();
const maize = id(), vegetables = id(), layers = id(), batch1 = id(), batch2 = id(), maizeCrop = id(), tomato = id();
const notAvailable = (reason: string) => ({ status: "UNAVAILABLE", reason });
const value = (text: string) => ({ status: "AVAILABLE", value: text });
const record = (kind: RecognitionRecord["kind"], amount: string, links: Partial<RecognitionRecord> = {}): RecognitionRecord => ({ recordId: id(), kind, amount, currency: "UGX", occurredOn: "2027-03-01", status: "POSTED", ...links });
const events = (records: RecognitionRecord[]) => recognizedEvents("ACCRUAL", records, []);
const cycle = (overrides: Partial<CropCycleFacts> = {}): CropCycleFacts => ({ cycleId: id(), enterpriseId: maize, cropId: maizeCrop, cropName: "Maize", areaPlanted: "3", areaUnit: "ACRE", status: "CLOSED", harvestedKg: "4000", lostKg: "250", ...overrides });
const batch = (overrides: Partial<BatchFacts> = {}): BatchFacts => ({ batchId: batch1, label: "Batch 1", enterpriseId: layers, animalTypeName: "Chicken", status: "CLOSED", startingQuantity: 100, birdsPurchased: "5", deaths: "3", ...overrides });

describe("crop formulas (MYF-P08-AC002, D-P08-005, D-P08-011)", () => {
  it("reproduces the approved worked example", () => {
    const [line] = cropMetrics([cycle()], events([record("EXPENSE", "2100000", { enterpriseId: maize }), record("SALE", "3000000", { enterpriseId: maize })]), "SEASON");
    expect(line).toMatchObject({ enterpriseId: maize, crops: ["Maize"], soFar: false, acres: value("3"), harvestedKg: "4000", keptKg: "3750", yieldPerAcre: value("1333.33") });
    expect(line.currencies).toEqual([{ currency: "UGX", costs: "2100000", revenue: "3000000", costPerAcre: value("700000"), revenuePerAcre: value("1000000"), costPerKg: value("560") }]);
  });
  it("converts exactly: 40,468.564224 square metres is exactly 10 acres", () => {
    const [line] = cropMetrics([cycle({ areaPlanted: "40468.564224", areaUnit: "SQUARE_METRE", harvestedKg: "5000", lostKg: "0" })], events([record("EXPENSE", "1000", { enterpriseId: maize })]), "SEASON");
    expect(line).toMatchObject({ acres: value("10"), yieldPerAcre: value("500") });
    expect(line.currencies[0].costPerAcre).toEqual(value("100"));
  });
  it("gives the same figures for the same land in hectares and square metres", () => {
    const money = events([record("EXPENSE", "1000000", { enterpriseId: maize })]);
    const hectare = cropMetrics([cycle({ areaPlanted: "1", areaUnit: "HECTARE" })], money, "SEASON"), metres = cropMetrics([cycle({ areaPlanted: "10000", areaUnit: "SQUARE_METRE" })], money, "SEASON");
    expect(hectare).toEqual(metres);
    expect(hectare[0].acres).toEqual(value("2.47"));
    expect(hectare[0].currencies[0].costPerAcre).toEqual(value("404685.64"));
  });
  it("adds each cycle's area once across units", () => {
    const [line] = cropMetrics([cycle({ harvestedKg: "1000", lostKg: "0" }), cycle({ areaPlanted: "4046.856422", areaUnit: "SQUARE_METRE", harvestedKg: "1000", lostKg: "0" })], events([record("EXPENSE", "400", { enterpriseId: maize })]), "ALL_RECORDS");
    expect(line).toMatchObject({ acres: value("4"), harvestedKg: "2000", keptKg: "2000", yieldPerAcre: value("500") });
    expect(line.currencies[0]).toMatchObject({ costPerAcre: value("100"), costPerKg: value("0.2") });
  });
  it("labels a cycle still open as so far", () => {
    expect(cropMetrics([cycle({ status: "ACTIVE" }), cycle()], [], "SEASON")[0].soFar).toBe(true);
  });
  it("zero area, zero harvest and everything lost say why, never 0", () => {
    const costs = events([record("EXPENSE", "100", { enterpriseId: maize })]);
    const [noArea] = cropMetrics([cycle({ areaPlanted: "0" })], costs, "SEASON");
    expect(noArea).toMatchObject({ acres: notAvailable("NO_AREA"), yieldPerAcre: notAvailable("NO_AREA") });
    expect(noArea.currencies[0].costPerAcre).toEqual(notAvailable("NO_AREA"));
    const [noHarvest] = cropMetrics([cycle({ harvestedKg: "0", lostKg: "0" })], costs, "SEASON");
    expect(noHarvest).toMatchObject({ yieldPerAcre: notAvailable("NO_HARVEST"), keptKg: "0" });
    expect(noHarvest.currencies[0]).toMatchObject({ costPerAcre: value("33.33"), costPerKg: notAvailable("NO_HARVEST") });
    const [allLost] = cropMetrics([cycle({ harvestedKg: "50", lostKg: "50" })], costs, "SEASON");
    expect(allLost).toMatchObject({ yieldPerAcre: value("16.67"), keptKg: "0" });
    expect(allLost.currencies[0].costPerKg).toEqual(notAvailable("NO_HARVEST"));
  });
  it("revenue of zero is a real zero per acre, because its denominator exists", () => {
    expect(cropMetrics([cycle()], events([record("EXPENSE", "100", { enterpriseId: maize })]), "SEASON")[0].currencies[0].revenuePerAcre).toEqual(value("0"));
  });
  it("more than one crop in an enterprise gives no per-acre or per-kg figure, but still shows its money (D-P08-010)", () => {
    const [line] = cropMetrics([cycle({ enterpriseId: vegetables, cropId: tomato, cropName: "Tomatoes" }), cycle({ enterpriseId: vegetables, cropName: "Cabbage" })], events([record("EXPENSE", "100", { enterpriseId: vegetables }), record("SALE", "300", { enterpriseId: vegetables })]), "SEASON");
    expect(line.crops).toEqual(["Cabbage", "Tomatoes"]);
    expect(line.yieldPerAcre).toEqual(notAvailable("MORE_THAN_ONE_CROP"));
    expect(line.currencies[0]).toEqual({ currency: "UGX", costs: "100", revenue: "300", costPerAcre: notAvailable("MORE_THAN_ONE_CROP"), revenuePerAcre: notAvailable("MORE_THAN_ONE_CROP"), costPerKg: notAvailable("MORE_THAN_ONE_CROP") });
  });
  it("a date range gives no per-acre or per-kg figure, because it holds part of the costs but all the acres", () => {
    const [line] = cropMetrics([cycle()], events([record("EXPENSE", "100", { enterpriseId: maize })]), "DATE_RANGE");
    expect(line.yieldPerAcre).toEqual(notAvailable("DATE_RANGE"));
    expect(line.currencies[0]).toMatchObject({ costPerAcre: notAvailable("DATE_RANGE"), costPerKg: notAvailable("DATE_RANGE") });
  });
  it("keeps currencies apart and counts only the enterprise's own money", () => {
    const [line] = cropMetrics([cycle()], events([record("EXPENSE", "300", { enterpriseId: maize }), record("EXPENSE", "9", { enterpriseId: maize, currency: "USD" }), record("EXPENSE", "999", { enterpriseId: layers }), record("EXPENSE", "999")]), "SEASON");
    expect(line.currencies.map(row => [row.currency, row.costs, row.costPerAcre])).toEqual([["UGX", "300", value("100")], ["USD", "9", value("3")]]);
  });
  it("reversed records leave the figures", () => {
    expect(cropMetrics([cycle()], events([record("EXPENSE", "300", { enterpriseId: maize }), record("EXPENSE", "999", { enterpriseId: maize, status: "REVERSED" })]), "SEASON")[0].currencies[0].costs).toBe("300");
  });
});

describe("bird formulas (MYF-P08-AC002, D-P08-006, D-P08-011)", () => {
  it("reproduces the approved worked example", () => {
    const [line] = batchMetrics([batch()], events([record("PURCHASE", "525000", { enterpriseId: layers, batchId: batch1 }), record("SALE", "630000", { enterpriseId: layers, batchId: batch1 })]));
    expect(line).toMatchObject({ batchId: batch1, soFar: false, birdsStarted: "105", deaths: "3", mortalityRate: value("2.9") });
    expect(line.currencies).toEqual([{ currency: "UGX", costs: "525000", revenue: "630000", costPerBird: value("5000"), revenuePerBird: value("6000"), enterpriseCostsNotLinked: "0" }]);
  });
  it("a missing flock denominator says why", () => {
    const [line] = batchMetrics([batch({ startingQuantity: 0, birdsPurchased: "0", deaths: "0" })], events([record("EXPENSE", "10", { enterpriseId: layers, batchId: batch1 })]));
    expect(line).toMatchObject({ birdsStarted: "0", mortalityRate: notAvailable("NO_BIRDS") });
    expect(line.currencies[0]).toMatchObject({ costPerBird: notAvailable("NO_BIRDS"), revenuePerBird: notAvailable("NO_BIRDS") });
  });
  it("keeps two batches apart and names enterprise costs linked to no batch", () => {
    const rows = events([record("EXPENSE", "100", { enterpriseId: layers, batchId: batch1 }), record("EXPENSE", "700", { enterpriseId: layers, batchId: batch2 }), record("EXPENSE", "50", { enterpriseId: layers }), record("EXPENSE", "999", { enterpriseId: maize })]);
    const [first, second] = batchMetrics([batch(), batch({ batchId: batch2, startingQuantity: 7, birdsPurchased: "0" })], rows);
    expect(first.currencies[0]).toMatchObject({ costs: "100", enterpriseCostsNotLinked: "50" });
    expect(second.currencies[0]).toMatchObject({ costs: "700", costPerBird: value("100"), enterpriseCostsNotLinked: "50" });
  });
  it("shows the unlinked warning even for a batch with nothing linked yet", () => {
    expect(batchMetrics([batch()], events([record("EXPENSE", "50", { enterpriseId: layers })]))[0].currencies).toEqual([expect.objectContaining({ currency: "UGX", costs: "0", enterpriseCostsNotLinked: "50" })]);
  });
  it("labels an active batch as so far, and has no money section with no money", () => {
    expect(batchMetrics([batch({ status: "ACTIVE" })], [])[0]).toMatchObject({ soFar: true, currencies: [] });
  });
});

describe("cost groups (D-P08-009)", () => {
  const labour = id(), feed = id(), rent = id();
  const groups = new Map<string, CostGroup>([[labour, "LABOUR"], [feed, "INPUT"]]);
  it("splits costs by the group stored on their category, and the parts add up to all costs", () => {
    const rows = events([record("EXPENSE", "100", { categoryId: labour }), record("PURCHASE", "30", { categoryId: feed }), record("EXPENSE", "20", { categoryId: feed }), record("EXPENSE", "7", { categoryId: rent }), record("SALE", "999", { categoryId: id() }), record("EXPENSE", "5", { currency: "USD", categoryId: labour })]);
    expect(costGroupTotals(rows, groups)).toEqual([{ currency: "UGX", labour: "100", inputs: "50", other: "7" }, { currency: "USD", labour: "5", inputs: "0", other: "0" }]);
  });
  it("has no line for a view with no costs", () => {
    expect(costGroupTotals(events([record("SALE", "5")]), groups)).toEqual([]);
  });
  it("the shipped groups are exactly the approved ones, in data and never in code", () => {
    const sql = readFileSync("prisma/migrations/202611040001_metric_links/migration.sql", "utf8");
    const catalog = readFileSync("prisma/migrations/202610250002_farm_accounting/migration.sql", "utf8");
    const nameOf = (seedId: string) => new RegExp("'" + seedId + "', 'COST', '([^']+)'").exec(catalog)?.[1];
    const ids = (text: string) => [...text.matchAll(/'(f4040002-[^']+)'/g)].map(match => match[1]);
    const labourLine = /SET "costGroup" = 'LABOUR' WHERE id = ('[^']+')/.exec(sql)?.[1] ?? "", inputList = /SET "costGroup" = 'INPUT' WHERE id IN \(([^)]+)\)/.exec(sql)?.[1] ?? "";
    expect(ids(labourLine).map(nameOf)).toEqual(["Labour"]);
    expect(ids(inputList).map(nameOf).sort()).toEqual(["Feed", "Fertilizer", "Medication", "Pesticides", "Seeds", "Veterinary"]);
  });
});

describe("stock value (MYF-P08-AC002, D-P08-004)", () => {
  const item = (overrides: Partial<StockItemFacts> = {}): StockItemFacts => ({ itemId: id(), name: "Maize", unit: "KG", quantity: "1000", lastSale: { amount: "120000", currency: "UGX", quantity: "100", soldOn: "2027-05-01" }, ...overrides });
  it("is the quantity at the last sale price, as an estimate with its date", () => {
    const result = stockValue([item()]);
    expect(result.items[0]).toMatchObject({ quantity: "1000", pricePerUnit: value("1200"), estimate: value("1200000"), currency: "UGX", soldOn: "2027-05-01" });
    expect(result.totals).toEqual([{ currency: "UGX", estimate: "1200000" }]);
  });
  it("is not available for an item never sold, and that item adds nothing to the total", () => {
    const result = stockValue([item({ name: "Beans", lastSale: null }), item()]);
    expect(result.items[0]).toMatchObject({ name: "Beans", pricePerUnit: notAvailable("NEVER_SOLD"), estimate: notAvailable("NEVER_SOLD"), currency: null, soldOn: null });
    expect(result.totals).toEqual([{ currency: "UGX", estimate: "1200000" }]);
  });
  it("leaves out items with nothing in stock", () => {
    expect(stockValue([item({ quantity: "0" })])).toEqual({ items: [], totals: [] });
  });
  it("adds the rounded lines, so the total visibly adds up, and keeps currencies apart", () => {
    const sale = { amount: "100", currency: "UGX", quantity: "3", soldOn: "2027-05-01" };
    const result = stockValue([item({ quantity: "1", lastSale: sale }), item({ name: "Peas", quantity: "1", lastSale: sale }), item({ name: "Eggs", quantity: "2", lastSale: { ...sale, currency: "USD" } })]);
    expect(result.items.filter(row => row.currency === "UGX").map(row => row.estimate)).toEqual([value("33.33"), value("33.33")]);
    expect(result.totals).toEqual([{ currency: "UGX", estimate: "66.66" }, { currency: "USD", estimate: "66.67" }]);
  });
  it("stays exact past what a stored amount could hold", () => {
    const result = stockValue([item({ quantity: "999999999999", lastSale: { amount: "9999999999999999", currency: "UGX", quantity: "1", soldOn: "2027-05-01" } })]);
    expect(result.items[0].estimate).toEqual(value("9999999999989999000000000001"));
  });
});
