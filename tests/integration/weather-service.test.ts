import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { activityRepository } from "@/modules/farm-activities/infrastructure/activity-repository";
import { ActivityService } from "@/modules/farm-activities/application/activity";
import { cropCycleRepository } from "@/modules/enterprises-seasons/infrastructure/crop-cycle-repository";
import { CropCycleService } from "@/modules/enterprises-seasons/application/crop-cycle";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
import { WeatherService } from "@/modules/weather-intelligence/application/weather";
import { weatherWriter } from "@/modules/weather-intelligence/infrastructure/writer";
import { weatherDigest } from "@/modules/weather-intelligence/infrastructure/services";
import { testForecastAdapter } from "@/modules/weather-intelligence/infrastructure/test-adapter";
import type { TestForecastAdapter } from "@/modules/weather-intelligence/contracts/weather";
import type { WeatherRequest } from "@/modules/weather-intelligence/contracts/service";

describe("Phase 13 authorized test forecasts and exact confirmed activity moves", () => {
  let mine: Awaited<ReturnType<typeof inventoryFixture>>, other: typeof mine;
  let now = new Date();
  beforeAll(async () => { mine = await inventoryFixture(); other = await inventoryFixture(); }, 120_000);
  afterAll(async () => {
    for (const f of [mine, other]) if (f) { await f.owner.productionActivity.deleteMany({ where: { tenantId: f.scope.tenantId } }); await f.cleanup(); }
  });
  function service(adapter?: (scenario: WeatherRequest["scenario"]) => TestForecastAdapter) {
    const farms = registryRepository(mine.runtime);
    const activities = new ActivityService(mine.auth, farms, activityRepository(mine.runtime));
    const crops = new CropCycleService(mine.auth, farms, cropCycleRepository(mine.runtime));
    return new WeatherService(mine.auth, farms, { farm: scope => mine.runtime.farm.findFirst({ where: { id: scope.farmId, tenantId: scope.tenantId }, select: { district: true } }), activity: (f,id) => activities.detail(f,id), crop: (f,id) => crops.cycle(f,id) },
      adapter ?? (scenario => testForecastAdapter(scenario, () => now)), weatherWriter(mine.runtime), weatherDigest, () => now, 30);
  }
  async function work() {
    now = new Date();
    const activities = new ActivityService(mine.auth, registryRepository(mine.runtime), activityRepository(mine.runtime));
    return activities.schedule(mine.scope.farmId, { requestId: crypto.randomUUID(), type: "SPRAYING", dueOn: addDays(farmToday(now),1), enterpriseId: mine.cycle.enterpriseId, plotId: mine.cycle.plotId });
  }
  const request = (activityId: string | null): WeatherRequest => ({ scenario: "RAIN", activityId, cycleId: mine.cycle.id, stage: "Farmer observed flowering" });
  async function grant() {
    const row = await work(); const input = request(row.activityId);
    const reviewed = await service().review(mine.scope.farmId, { input, newDueOn: addDays(row.dueOn,1) });
    return { row, reviewed, command: { ...reviewed.confirmation, requestId: crypto.randomUUID(), confirmed: true as const } };
  }
  it("provides all six signals and source context without changing work or storing stage/forecast data", async () => {
    const row = await work(); const before = await mine.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } });
    const report = await service().check(mine.scope.farmId, request(row.activityId));
    expect(report).toMatchObject({ testOnly: true, district: "Rukungiri", crop: "Maize", stage: "Farmer observed flowering", activity: { status: "TEST_NOTICE" }, taskContext: {enterprise:"Maize",plot:"Plot"} });
    expect(report.notices).toHaveLength(6);
    expect(await mine.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } })).toEqual(before);
    expect(await mine.owner.auditEvent.count({ where: { tenantId: mine.scope.tenantId, action: { startsWith: "WEATHER_MOVE:" } } })).toBe(0);
  });
  it("refuses foreign farms and nested IDs before contacting a provider", async () => {
    const fetch = vi.fn(async () => null); const s = service(() => ({ fetch }));
    await expect(s.check(other.scope.farmId, request(null))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(s.check(mine.scope.farmId, { ...request(null), cycleId: other.cycle.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(s.check(mine.scope.farmId, { ...request(crypto.randomUUID()), cycleId: null, stage: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rechecks access after a slow provider", async () => {
    const fetch = async () => { await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "REVOKED" } }); return null; };
    try { await expect(service(() => ({ fetch })).check(mine.scope.farmId, request(null))).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "ACTIVE" } }); }
  });
  it.each(["timeout", "unknown-fields", "wrong-place", "failure"])("handles %s without weather claims", async kind => {
    const fetch = async () => {
      if (kind === "timeout") return new Promise(() => {});
      if (kind === "failure") throw new Error("provider failed");
      const data = await testForecastAdapter("RAIN", () => now).fetch("wrong-place", new AbortController().signal);
      return kind === "unknown-fields" ? { ...Object(data), confirmed: true } : data;
    };
    const report = await service(() => ({ fetch })).check(mine.scope.farmId, request(null));
    expect(report.forecast).toBeNull(); expect(report.notices.every(n => n.status === "UNAVAILABLE")).toBe(true);
  });
  it("creates one atomic date change and receipt across concurrent identical retries; changed replay conflicts", async () => {
    const { row, command } = await grant();
    const results = await Promise.all([service().confirm(mine.scope.farmId, command), service().confirm(mine.scope.farmId, command)]);
    expect(results[0]).toEqual(results[1]);
    const stored = await mine.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } });
    expect(stored.version).toBe(2); expect(stored.dueOn.toISOString().slice(0,10)).toBe(command.newDueOn);
    expect(await mine.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(1);
    await expect(service().confirm(mine.scope.farmId, { ...command, expectedVersion: 100 })).rejects.toMatchObject({ code: "CONFLICT" });
    now = new Date(now.getTime()+3600_000); expect(await service().confirm(mine.scope.farmId, command)).toEqual(results[0]); now = new Date();
  });
  it("requires separate consent and re-review after changed dates or payload", async () => {
    const { row, command } = await grant();
    for (const changed of [{ confirmed: false }, { newDueOn: addDays(command.newDueOn,1) }, { reviewHash: "0".repeat(64) }, { expectedVersion: 9 }, { oldDueOn: addDays(command.oldDueOn,-1) }]) await expect(service().confirm(mine.scope.farmId, { ...command, ...changed })).rejects.toBeDefined();
    expect((await mine.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } })).version).toBe(1);
    expect(await mine.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
  });
  it("normalizes valid uppercase UUIDs before exact confirmation and replay",async()=>{
    const { row,command }=await grant();
    const uppercase={...command,requestId:command.requestId.toUpperCase(),input:{...command.input,activityId:command.input.activityId?.toUpperCase(),cycleId:command.input.cycleId?.toUpperCase()}};
    const first=await service().confirm(mine.scope.farmId,uppercase);
    expect(await service().confirm(mine.scope.farmId,uppercase)).toEqual(first);
    expect(await service().confirm(mine.scope.farmId,command)).toEqual(first);
    expect((await mine.owner.productionActivity.findUniqueOrThrow({where:{id:row.activityId}})).version).toBe(2);
  });
  it("refuses revocation, expiry and concurrent distinct moves", async () => {
    const { row, command } = await grant();
    await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "REVOKED" } });
    try { await expect(service().confirm(mine.scope.farmId, command)).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "ACTIVE" } }); }
    now = new Date(command.expiresAt); await expect(service().confirm(mine.scope.farmId, command)).rejects.toMatchObject({ code: "CONFLICT" }); now = new Date();
    const results = await Promise.allSettled([service().confirm(mine.scope.farmId, command), service().confirm(mine.scope.farmId, { ...command, requestId: crypto.randomUUID() })]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await mine.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } })).version).toBe(2);
  });
  it("runtime date permissions cannot rewrite other scheduled details or edit closed work", async () => {
    const row = await work();
    await expect(mine.runtime.productionActivity.update({ where: { id: row.activityId }, data: { notes: "unreviewed" } })).rejects.toBeDefined();
    await mine.owner.productionActivity.update({ where: { id: row.activityId }, data: { status: "CANCELLED", cancelledAt: now, cancelledBy: mine.scope.actorId } });
    await expect(mine.runtime.productionActivity.update({ where: { id: row.activityId }, data: { dueOn: new Date(addDays(row.dueOn,1)+"T00:00:00Z") } })).rejects.toBeDefined();
  });
  it.each(["expiry", "revocation"] as const)("rechecks %s after a row-lock wait and rolls back its receipt", async kind => {
    const { row, command } = await grant();
    const blocker = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await blocker.connect();
    await blocker.query('BEGIN'); await blocker.query('SELECT id FROM "ProductionActivity" WHERE id=$1 FOR UPDATE',[row.activityId]);
    const pending = weatherWriter(mine.runtime).move(mine.scope, { ...command, expiresAt: new Date(Date.now()+250).toISOString() }, "Rukungiri");
    const asserted = expect(pending).rejects.toMatchObject({ code: kind === "revocation" ? "FORBIDDEN" : "CONFLICT" });
    try {
      await new Promise(resolve => setTimeout(resolve,350));
      if (kind === "revocation") await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "REVOKED" } });
      await blocker.query('COMMIT'); await asserted;
      expect(await mine.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
      expect((await mine.owner.productionActivity.findUniqueOrThrow({ where: { id: row.activityId } })).version).toBe(1);
    } finally { await blocker.query('ROLLBACK'); await blocker.end(); await mine.owner.farmMember.updateMany({ where: { farmId: mine.scope.farmId }, data: { status: "ACTIVE" } }); }
  });
});
