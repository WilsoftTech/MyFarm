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

// Farm date 2026-11-11 in Africa/Kampala: current window 2026-10-14..2026-11-10, earlier 2026-09-16..2026-10-13.
const now = new Date("2026-11-11T09:00:00.000Z");
const id = () => crypto.randomUUID();
const FEED = "f4040002-0000-4000-8000-000000000112";
let f: Awaited<ReturnType<typeof inventoryFixture>>, service: FarmIntelligenceService, accounts: FarmAccountingService, flock: PoultryProductionService, stock: StockService;
let farm: string, poultry: string, golden: string, secondFarm: string;

async function newBatch(label: string, startingQuantity = 500, acquired = "2026-08-01") {
  const animal = await f.owner.animalTypeCatalog.findFirstOrThrow();
  return (await f.owner.poultryBatch.create({ data: { tenantId: f.scope.tenantId, farmId: farm, enterpriseId: poultry, animalTypeId: animal.id, animalTypeName: animal.name, batchLabel: label,
    batchLabelKey: label.toLowerCase(), startingQuantity, acquisitionDate: new Date(acquired + "T00:00:00Z"), purpose: "EGGS", createdBy: f.scope.actorId } })).id;
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
    const mine = feed.insights.filter(row => row.batchId === golden);
    expect(feed).toMatchObject({ evaluatedOn: "2026-11-11", batchesChecked: 1, batchesTruncated: false });
    expect(mine.map(row => [row.ruleKey, row.severity, row.status, row.currency, row.ruleVersion, row.version])).toEqual([
      ["PRODUCTION_FALLING_COSTS_RISING", "WARNING", "OPEN", "UGX", 1, 1], ["MORTALITY_RISING", "WATCH", "OPEN", null, 1, 1],
    ]);
    expect(mine[0].evidence).toMatchObject({ evidenceVersion: 1, batchLabel: "Layers A", windows: { earlier: { from: "2026-09-16", to: "2026-10-13" }, current: { from: "2026-10-14", to: "2026-11-10" } },
      coverage: { earlier: { birdsAtStart: "500", recordedDays: [7, 7, 7, 7] }, current: { birdsAtStart: "495", eggDays: [7, 7, 7, 7] } } });
    expect(mine[0].evidence.figures.map(row => [row.rule, row.earlier, row.current, row.change])).toEqual([["FEED_COST_RISING", "1000", "1240", "24"], ["EGGS_FALLING", "80", "70.4", "-12"]]);
    expect(mine[1].evidence.figures[0]).toMatchObject({ earlier: "1", current: "2.4", change: "1.4" });
    expect(feed.notJudged.filter(row => row.batchId === golden)).toEqual([]);
  });

  it("opening the feed again, or twice at once, keeps one live insight per rule", async () => {
    const before = (await live(golden)).map(row => row.id);
    await Promise.all([service.feed(farm), service.feed(farm), service.feed(farm)]);
    expect((await live(golden)).map(row => row.id)).toEqual(before);
    const twin = await goldenBatch("Layers B");
    await Promise.all([service.feed(farm), service.feed(farm)]);
    expect((await live(twin)).map(row => row.ruleKey)).toEqual(["MORTALITY_RISING", "PRODUCTION_FALLING_COSTS_RISING"]);
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
    expect(raised.evidence.figures[0]).toMatchObject({ current: "3.4", change: "2.4" });
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
    expect(await live(closing)).toHaveLength(2);
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
  it("the table itself refuses a live key that does not match the insight", async () => {
    await expect(f.owner.farmInsight.create({ data: { id: id(), tenantId: f.scope.tenantId, farmId: farm, batchId: golden, ruleKey: "EGGS_FALLING", ruleVersion: 1, severity: "WATCH",
      liveKey: "something-else", evaluatedOn: new Date("2026-11-11T00:00:00Z"), evidence: { evidenceVersion: 1 } } })).rejects.toThrow();
  });
});
