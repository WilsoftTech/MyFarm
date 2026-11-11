import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { PoultryProductionService } from "@/modules/harvest-inventory/application/production";
import { poultryProductionRepository } from "@/modules/harvest-inventory/infrastructure/production-repository";
import { StockService } from "@/modules/harvest-inventory/application/stock";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
import { FarmIntelligenceService } from "@/modules/farm-intelligence/application/insights";
import { insightRepository } from "@/modules/farm-intelligence/infrastructure/insight-repository";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
import { isThresholdEvidence, type InsightEvidence, type ThresholdEvidence, type TrendEvidence } from "@/modules/farm-intelligence/contracts/insights";

// Farm date 2026-11-11 in Africa/Kampala: current window 2026-10-14..2026-11-10, earlier 2026-09-16..2026-10-13.
const now = new Date("2026-11-11T09:00:00.000Z");
const id = () => crypto.randomUUID();
const FEED = "f4040002-0000-4000-8000-000000000112";
let f: Awaited<ReturnType<typeof inventoryFixture>>, service: FarmIntelligenceService, accounts: FarmAccountingService, flock: PoultryProductionService, stock: StockService;
let farm: string, poultry: string, golden: string, secondFarm: string;

async function newBatch(label: string, startingQuantity = 500, acquired = "2026-08-01", purpose: "EGGS" | "MEAT" = "EGGS") {
  const animal = await f.owner.animalTypeCatalog.findFirstOrThrow();
  return (await f.owner.poultryBatch.create({ data: { tenantId: f.scope.tenantId, farmId: farm, enterpriseId: poultry, animalTypeId: animal.id, animalTypeName: animal.name, batchLabel: label,
    batchLabelKey: label.toLowerCase(), startingQuantity, acquisitionDate: new Date(acquired + "T00:00:00Z"), purpose, createdBy: f.scope.actorId } })).id;
}
/** Daily egg entries written directly, as many days of records would be; deaths and costs go through the services. */
async function eggs(batchId: string, from: string, perDay: (index: number) => number) {
  await f.owner.productionEvent.createMany({ data: Array.from({ length: 28 }, (_, index) => ({ id: id(), tenantId: f.scope.tenantId, farmId: farm, batchId, locationId: f.location.storageLocationId,
    type: "EGGS", quantity: String(perDay(index)), unit: "EGG", occurredOn: new Date(addDays(from, index) + "T00:00:00Z"), requestHash: id().replaceAll("-", "").padEnd(64, "0"), createdBy: f.scope.actorId })) });
}
const record = (batchId: string, type: string, quantity: string, unit: string, occurredOn: string) =>
  flock.record(farm, { requestId: id(), batchId, locationId: f.location.storageLocationId, type, quantity, unit, occurredOn });
const feedCost = (batchId: string, amount: string, occurredOn: string) =>
  accounts.recordTransaction("EXPENSE", farm, { requestId: id(), categoryId: FEED, amount, currency: "UGX", occurredOn, batchId, enterpriseId: poultry });
/** The source example: feed cost +24%, eggs -12%, deaths +1.4 points. */
async function goldenBatch(label: string) {
  const batchId = await newBatch(label);
  await eggs(batchId, "2026-09-16", () => 400);
  await eggs(batchId, "2026-10-14", index => index < 13 ? 349 : 348);
  await record(batchId, "MORTALITY", "5", "BIRD", "2026-10-13");
  await record(batchId, "MORTALITY", "12", "BIRD", "2026-11-10");
  for (const [amount, on] of [["250000", "2026-09-20"], ["250000", "2026-10-04"], ["306900", "2026-10-18"], ["306900", "2026-11-01"]]) await feedCost(batchId, amount, on);
  return batchId;
}
function trend(evidence: InsightEvidence): TrendEvidence { if (isThresholdEvidence(evidence)) throw new Error("expected trend evidence"); return evidence; }
function threshold(evidence: InsightEvidence): ThresholdEvidence { if (!isThresholdEvidence(evidence)) throw new Error("expected threshold evidence"); return evidence; }
const live = (batchId: string) => f.owner.farmInsight.findMany({ where: { batchId, liveKey: { not: null } }, orderBy: { ruleKey: "asc" } });

beforeAll(async () => {
  f = await inventoryFixture();
  farm = f.scope.farmId;
  const registry = registryRepository(f.runtime);
  service = new FarmIntelligenceService(f.auth, registry, insightRepository(f.runtime), () => now);
  accounts = new FarmAccountingService(f.auth, registry, farmAccountingRepository(f.runtime));
  flock = new PoultryProductionService(f.auth, registry, poultryProductionRepository(f.runtime));
  stock = new StockService(f.auth, registry, stockRepository(f.runtime));
  poultry = (await f.owner.enterprise.create({ data: { tenantId: f.scope.tenantId, farmId: farm, name: "Layers", type: "POULTRY", createdBy: f.scope.actorId } })).id;
  golden = await goldenBatch("Layers A");
  // A second farm of the same farmer, to prove an insight is only reachable through its own farm.
  const farmer = await f.owner.farmer.findFirstOrThrow({ where: { tenantId: f.scope.tenantId } });
  secondFarm = (await f.owner.farm.create({ data: { id: id(), tenantId: f.scope.tenantId, ownerFarmerId: farmer.id, name: "Second farm", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "POULTRY", createdBy: f.scope.actorId } })).id;
  await f.owner.farmMember.create({ data: { userId: f.scope.actorId, farmId: secondFarm, tenantId: f.scope.tenantId, role: "OWNER" } });
}, 120_000);
afterAll(async () => { if (f) await f.cleanup(); });

describe("MYF-P10-R001 insights from real records under the restricted role (P10-T002)", () => {
  it("golden: raises the combined feed-and-eggs warning and a mortality watch, with their evidence", async () => {
    const feed = await service.feed(farm);
    const mine = feed.insights.filter(row => row.batchId === golden && !isThresholdEvidence(row.evidence));
    expect(feed).toMatchObject({ evaluatedOn: "2026-11-11", batchesChecked: 1, batchesTruncated: false });
    expect(mine.map(row => [row.ruleKey, row.severity, row.status, row.currency, row.ruleVersion, row.version])).toEqual([
      ["PRODUCTION_FALLING_COSTS_RISING", "WARNING", "OPEN", "UGX", 1, 1], ["MORTALITY_RISING", "WATCH", "OPEN", null, 1, 1],
    ]);
    expect(trend(mine[0].evidence)).toMatchObject({ evidenceVersion: 1, batchLabel: "Layers A", windows: { earlier: { from: "2026-09-16", to: "2026-10-13" }, current: { from: "2026-10-14", to: "2026-11-10" } },
      coverage: { earlier: { birdsAtStart: "500", recordedDays: [7, 7, 7, 7] }, current: { birdsAtStart: "495", eggDays: [7, 7, 7, 7] } } });
    expect(trend(mine[0].evidence).figures.map(row => [row.rule, row.earlier, row.current, row.change])).toEqual([["FEED_COST_RISING", "1000", "1240", "24"], ["EGGS_FALLING", "80", "70.4", "-12"]]);
    expect(trend(mine[1].evidence).figures[0]).toMatchObject({ earlier: "1", current: "2.4", change: "1.4" });
    expect(feed.notJudged.filter(row => row.batchId === golden)).toEqual([]);
  });

  it("opening the feed again, or twice at once, keeps one live insight per rule", async () => {
    const before = (await live(golden)).map(row => row.id);
    await Promise.all([service.feed(farm), service.feed(farm), service.feed(farm)]);
    expect((await live(golden)).map(row => row.id)).toEqual(before);
    const twin = await goldenBatch("Layers B");
    await Promise.all([service.feed(farm), service.feed(farm)]);
    expect((await live(twin)).map(row => row.ruleKey)).toEqual(["HIGH_MORTALITY", "MORTALITY_RISING", "PRODUCTION_FALLING_COSTS_RISING"]);
  });

  it("acknowledging is retry-safe and version-checked, and an acknowledged insight is not raised again", async () => {
    const insight = (await service.feed(farm)).insights.find(row => row.batchId === golden && row.ruleKey === "MORTALITY_RISING")!;
    const command = { requestId: id(), expectedVersion: insight.version };
    const [first, again] = await Promise.all([service.acknowledge(farm, insight.insightId, command), service.acknowledge(farm, insight.insightId, command)]);
    expect(first).toMatchObject({ status: "ACKNOWLEDGED", version: 2 }); expect(again).toEqual(first);
    expect(first.acknowledgedAt).not.toBeNull();
    await expect(service.acknowledge(farm, insight.insightId, { requestId: id(), expectedVersion: 1 })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.acknowledge(farm, insight.insightId, { requestId: command.requestId, expectedVersion: 7 })).rejects.toMatchObject({ code: "CONFLICT" });
    const after = (await service.feed(farm)).insights.filter(row => row.batchId === golden && row.ruleKey === "MORTALITY_RISING");
    expect(after.map(row => [row.insightId, row.status])).toEqual([[insight.insightId, "ACKNOWLEDGED"]]);
    expect(await f.owner.auditEvent.count({ where: { action: "INSIGHT_ACKNOWLEDGED", requestId: command.requestId } })).toBe(1);
  });

  it("a reversed entry is left out; a worse figure after acknowledgement is raised afresh", async () => {
    const acknowledged = (await live(golden)).find(row => row.ruleKey === "MORTALITY_RISING")!;
    const mistaken = await record(golden, "MORTALITY", "20", "BIRD", "2026-11-09");
    await stock.reverse(farm, { requestId: id(), targetType: "PRODUCTION", targetId: mistaken.eventId, reason: "Entered by mistake", occurredOn: "2026-11-10", confirmed: true });
    await service.feed(farm);
    expect((await live(golden)).find(row => row.ruleKey === "MORTALITY_RISING")!.id).toBe(acknowledged.id);
    await record(golden, "MORTALITY", "5", "BIRD", "2026-11-09");
    const feed = await service.feed(farm);
    const raised = feed.insights.find(row => row.batchId === golden && row.ruleKey === "MORTALITY_RISING")!;
    expect(raised).toMatchObject({ status: "OPEN", version: 1 }); expect(raised.insightId).not.toBe(acknowledged.id);
    expect(trend(raised.evidence).figures[0]).toMatchObject({ current: "3.4", change: "2.4" });
    expect(await f.owner.farmInsight.findUniqueOrThrow({ where: { id: acknowledged.id } })).toMatchObject({ status: "CLEARED", liveKey: null, version: 3 });
  });

  it("thin records say what is missing instead of guessing", async () => {
    const thin = await newBatch("Thin");
    await eggs(thin, "2026-10-14", () => 400);
    const feed = await service.feed(farm);
    expect(feed.insights.some(row => row.batchId === thin)).toBe(false);
    expect(feed.notJudged.filter(row => row.batchId === thin).map(row => [row.rule, row.missing])).toEqual([
      ["FEED_COST_RISING", ["FEW_RECORDED_DAYS", "NO_FEED_COST"]], ["EGGS_FALLING", ["FEW_EGG_DAYS", "NO_EARLIER_EGGS"]], ["MORTALITY_RISING", ["FEW_RECORDED_DAYS"]],
    ]);
  });

  it("closing a batch clears what was raised on it", async () => {
    const closing = await goldenBatch("Layers C");
    await service.feed(farm);
    expect(await live(closing)).toHaveLength(3);
    await f.owner.poultryBatch.update({ where: { id: closing }, data: { status: "CLOSED" } });
    const feed = await service.feed(farm);
    expect(feed.insights.some(row => row.batchId === closing)).toBe(false);
    expect(await live(closing)).toEqual([]);
  });

  it("denies other farms, guessed insights and an insight reached through another farm", async () => {
    await expect(service.feed(id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    const insight = (await live(golden))[0];
    await expect(service.acknowledge(farm, id(), { requestId: id(), expectedVersion: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.acknowledge(secondFarm, insight.id, { requestId: id(), expectedVersion: insight.version })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.acknowledge(farm, insight.id, { requestId: id(), expectedVersion: insight.version, status: "CLEARED" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await service.feed(secondFarm)).insights).toEqual([]);
  });

  it("a member who leaves the farm can no longer read or acknowledge", async () => {
    await f.owner.farmMember.updateMany({ where: { farmId: farm, userId: f.scope.actorId }, data: { status: "REVOKED" } });
    try {
      await expect(service.feed(farm)).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally { await f.owner.farmMember.updateMany({ where: { farmId: farm, userId: f.scope.actorId }, data: { status: "ACTIVE" } }); }
  });
});

describe("MYF-P10-R002 threshold warnings from real records (P10-T005)", () => {
  const revenue = async () => (await f.owner.transactionCategory.findFirstOrThrow({ where: { kind: "REVENUE", active: true }, orderBy: { id: "asc" } })).id;
  const mine = async (subjectId: string, ruleKey: string) => (await service.feed(farm)).insights.filter(row => (row.batchId ?? row.cropCycleId) === subjectId && row.ruleKey === ruleKey);

  it("high mortality: 12 of 495 birds in the last 7 days is a Warning with its inputs (D-P10-003)", async () => {
    const [row] = await mine(golden, "HIGH_MORTALITY");
    expect(row).toMatchObject({ severity: "WARNING", status: "OPEN", ruleVersion: 1, cropCycleId: null });
    expect(threshold(row.evidence)).toMatchObject({ kind: "THRESHOLD", subject: { kind: "BATCH", label: "Layers A" },
      figure: { window: { from: "2026-11-04", to: "2026-11-10" }, values: { deaths: "12", birdsAtRisk: "495", rate: "2.4", recordedDays: "7" } } });
  });

  it("feed running low: the farmer picks the batch's feed item; 300 kg at 50 kg a day is 6 days (D-P10-005, D-P10-007)", async () => {
    const feeder = await newBatch("Feeder");
    await f.owner.productionEvent.createMany({ data: Array.from({ length: 14 }, (_, index) => ({ id: id(), tenantId: f.scope.tenantId, farmId: farm, batchId: feeder, locationId: f.location.storageLocationId,
      type: "FEED", quantity: "50", unit: "KG", occurredOn: new Date(addDays("2026-10-28", index) + "T00:00:00Z"), requestHash: "f".repeat(64), createdBy: f.scope.actorId })) });
    expect((await service.feed(farm)).thresholdsNotJudged.filter(row => row.subject.id === feeder && row.rule === "FEED_RUNNING_LOW").map(row => row.missing)).toEqual([["NO_FEED_ITEM"]]);
    const mash = await stock.createItem(farm, { requestId: id(), name: "Layer mash", unit: "KG" });
    await stock.post(farm, { requestId: id(), itemId: mash.itemId, locationId: f.location.storageLocationId, type: "ADJUSTMENT", direction: "IN", quantity: "300", unit: "KG", occurredOn: "2026-10-27", reason: "Opening count" });
    const choose = { requestId: id(), itemId: mash.itemId, expectedVersion: null };
    const [first, again] = await Promise.all([service.setFeedItem(farm, feeder, choose), service.setFeedItem(farm, feeder, choose)]);
    expect(first).toEqual({ batchId: feeder, itemId: mash.itemId, itemName: "Layer mash", unit: "KG", version: 1 }); expect(again).toEqual(first);
    expect(await service.feedItem(farm, feeder)).toEqual(first);
    await expect(service.feedItem(secondFarm, feeder)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.setFeedItem(farm, feeder, { requestId: id(), itemId: mash.itemId, expectedVersion: null })).rejects.toMatchObject({ code: "CONFLICT" });
    const [row] = await mine(feeder, "FEED_RUNNING_LOW");
    expect(threshold(row.evidence).figure).toMatchObject({ window: { from: "2026-10-28", to: "2026-11-10" }, values: { itemName: "Layer mash", stockKg: "300", dailyUseKg: "50", daysLeft: "6", feedDays: "7, 7" } });
    expect(row.severity).toBe("WARNING");
    // Restocking to 400 kg (8 days) is judged and clears it.
    await stock.post(farm, { requestId: id(), itemId: mash.itemId, locationId: f.location.storageLocationId, type: "ADJUSTMENT", direction: "IN", quantity: "100", unit: "KG", occurredOn: "2026-11-10", reason: "Delivery" });
    expect(await mine(feeder, "FEED_RUNNING_LOW")).toEqual([]);
    expect(await f.owner.farmInsight.findUniqueOrThrow({ where: { id: row.insightId } })).toMatchObject({ status: "CLEARED" });
  });

  it("only a supply item of the same farm can be a batch's feed", async () => {
    const batch = await newBatch("Feed rules");
    const birds = await f.owner.inventoryItem.findFirstOrThrow({ where: { tenantId: f.scope.tenantId, kind: "BIRD" } });
    await expect(service.setFeedItem(farm, batch, { requestId: id(), itemId: birds.id, expectedVersion: null })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.setFeedItem(farm, batch, { requestId: id(), itemId: id(), expectedVersion: null })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service.setFeedItem(farm, id(), { requestId: id(), itemId: id(), expectedVersion: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = await stock.createItem(farm, { requestId: id(), name: "Grower mash", unit: "KG" });
    await expect(service.setFeedItem(secondFarm, batch, { requestId: id(), itemId: other.itemId, expectedVersion: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.setFeedItem(farm, batch, { requestId: id(), itemId: other.itemId, expectedVersion: null, batchId: batch })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("loss per egg: 200,000 UGX for 2,000 eggs is 100 UGX each, against eggs sold at 50 UGX (D-P10-005)", async () => {
    const sellers = await newBatch("Sellers");
    await record(sellers, "EGGS", "2000", "EGG", "2026-11-01");
    await feedCost(sellers, "200000", "2026-10-20");
    const eggItem = await f.owner.inventoryItem.findFirstOrThrow({ where: { batchId: sellers, kind: "EGG" } });
    await stock.post(farm, { requestId: id(), itemId: eggItem.id, locationId: f.location.storageLocationId, type: "SALE", quantity: "1000", unit: "EGG", occurredOn: "2026-11-02", reason: "Market", sale: { categoryId: await revenue(), amount: "50000", currency: "UGX" } });
    const [row] = await mine(sellers, "LOSS_PER_EGG");
    expect(row).toMatchObject({ severity: "WARNING", currency: "UGX" });
    expect(threshold(row.evidence).figure).toMatchObject({ window: { from: "2026-10-14", to: "2026-11-10" }, values: { costs: "200000", produced: "2000", costPerUnit: "100", sales: "50000", sold: "1000", pricePerUnit: "50" } });
  });

  it("loss per bird: a meat batch at 5,000 UGX a bird sold at 4,000 is a loss; a laying batch is not judged per bird", async () => {
    const broilers = await newBatch("Broilers", 100, "2026-09-01", "MEAT");
    await feedCost(broilers, "500000", "2026-09-10");
    await flock.record(farm, { requestId: id(), batchId: broilers, locationId: f.location.storageLocationId, type: "BIRD_SALE", quantity: "10", unit: "BIRD", occurredOn: "2026-11-05", sale: { categoryId: await revenue(), amount: "40000", currency: "UGX" } });
    const [row] = await mine(broilers, "LOSS_PER_BIRD");
    expect(threshold(row.evidence).figure).toMatchObject({ window: null, values: { costPerUnit: "5000", pricePerUnit: "4000", produced: "100", sold: "10" } });
    expect((await service.feed(farm)).insights.some(item => item.batchId === golden && item.ruleKey === "LOSS_PER_BIRD")).toBe(false);
  });

  it("loss per kg: the crop's season costs per kg kept against its sales, as a crop-cycle insight", async () => {
    const harvest = await f.harvest.record(farm, f.command());
    await accounts.recordTransaction("EXPENSE", farm, { requestId: id(), categoryId: FEED, amount: "1260000", currency: "UGX", occurredOn: "2026-04-01", enterpriseId: f.cycle.enterpriseId, seasonId: f.cycle.seasonId });
    await stock.post(farm, { requestId: id(), itemId: harvest.itemId, locationId: f.location.storageLocationId, type: "SALE", quantity: "1000", unit: "KG", occurredOn: "2026-10-15", reason: "Market", sale: { categoryId: await revenue(), amount: "550000", currency: "UGX" } });
    const [row] = await mine(f.cycle.id, "LOSS_PER_KG");
    expect(row).toMatchObject({ batchId: null, cropCycleId: f.cycle.id, severity: "WARNING" });
    expect(threshold(row.evidence)).toMatchObject({ subject: { kind: "CROP_CYCLE", label: "Maize, 2026" }, figure: { window: null, values: { costs: "1260000", produced: "2250", costPerUnit: "560", pricePerUnit: "550" } } });
    expect((await service.feed(farm)).cropCyclesChecked).toBe(1);
  });
});

describe("migration 202611120001", () => {
  it("marks exactly the approved Feed category as the feed metric, as data", async () => {
    expect(await f.owner.transactionCategory.findMany({ where: { metric: { not: null } }, select: { id: true, name: true, kind: true, metric: true } })).toEqual([{ id: FEED, name: "Feed", kind: "COST", metric: "FEED" }]);
    await expect(f.owner.$executeRawUnsafe(`UPDATE "TransactionCategory" SET metric = 'FEED' WHERE kind = 'REVENUE'`)).rejects.toThrow();
  });
});

describe("the app's database role cannot rewrite an insight (runtime policy)", () => {
  const denied = (sql: string, ...values: unknown[]) => expect(f.runtime.$executeRawUnsafe(sql, ...values)).rejects.toThrow();
  it("cannot change the evidence or rule, delete, reopen a cleared insight, or add one already acknowledged", async () => {
    const row = (await live(golden))[0];
    await denied('UPDATE "FarmInsight" SET evidence = \'{"evidenceVersion":1}\'::jsonb WHERE id = $1::uuid', row.id);
    await denied('UPDATE "FarmInsight" SET "ruleKey" = \'EGGS_FALLING\' WHERE id = $1::uuid', row.id);
    await denied('DELETE FROM "FarmInsight" WHERE id = $1::uuid', row.id);
    const cleared = await f.owner.farmInsight.findFirstOrThrow({ where: { batchId: golden, status: "CLEARED" } });
    expect(await f.runtime.$executeRawUnsafe('UPDATE "FarmInsight" SET status = \'OPEN\', "liveKey" = $2, "clearedOn" = NULL WHERE id = $1::uuid', cleared.id, cleared.batchId + ":" + cleared.ruleKey + ":")).toBe(0);
    await denied(`INSERT INTO "FarmInsight" (id, "tenantId", "farmId", "batchId", "ruleKey", "ruleVersion", severity, status, "liveKey", "evaluatedOn", evidence, "acknowledgedAt", "acknowledgedBy")
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'EGGS_FALLING', 1, 'WATCH', 'ACKNOWLEDGED', $4 || ':EGGS_FALLING:', '2026-11-11', '{"evidenceVersion":1}'::jsonb, now(), $5::uuid)`, id(), f.scope.tenantId, farm, golden, f.scope.actorId);
  });
  it("cannot link a batch to an item that is not a supply, or point an insight at two subjects", async () => {
    const egg = await f.owner.inventoryItem.findFirstOrThrow({ where: { tenantId: f.scope.tenantId, kind: "EGG" } });
    const batch = await newBatch("Policy check");
    await denied('INSERT INTO "BatchFeedItem" (id, "tenantId", "farmId", "batchId", "itemId", "changedBy") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid)', id(), f.scope.tenantId, farm, batch, egg.id, f.scope.actorId);
    await denied('DELETE FROM "BatchFeedItem"');
    await expect(f.owner.farmInsight.create({ data: { id: id(), tenantId: f.scope.tenantId, farmId: farm, batchId: golden, cropCycleId: f.cycle.id, ruleKey: "LOSS_PER_KG", ruleVersion: 1, severity: "WARNING",
      liveKey: golden + ":LOSS_PER_KG:", evaluatedOn: new Date("2026-11-11T00:00:00Z"), evidence: { evidenceVersion: 1 } } })).rejects.toThrow();
  });
  it("the table itself refuses a live key that does not match the insight", async () => {
    await expect(f.owner.farmInsight.create({ data: { id: id(), tenantId: f.scope.tenantId, farmId: farm, batchId: golden, ruleKey: "EGGS_FALLING", ruleVersion: 1, severity: "WATCH",
      liveKey: "something-else", evaluatedOn: new Date("2026-11-11T00:00:00Z"), evidence: { evidenceVersion: 1 } } })).rejects.toThrow();
  });
});
