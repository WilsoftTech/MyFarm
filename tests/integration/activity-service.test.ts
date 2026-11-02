import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { activityFixture } from "../support/activity-fixture";

let f: Awaited<ReturnType<typeof activityFixture>>;
beforeAll(async () => { f = await activityFixture(); }, 30_000);
afterAll(async () => { if (f) await f.cleanup(); });
const farmA = () => f.a.scope.farmId;

describe("MYF-P06-T002 authorized activity scheduling", () => {
  it("schedules every available crop and poultry activity and lists it for the farm", async () => {
    for (const type of ["PLANTING", "IRRIGATION", "WEEDING", "SPRAYING", "FERTILIZING", "HARVESTING", "PRUNING", "INSPECTION"]) {
      expect(await f.a.activities.schedule(farmA(), f.command({ type }))).toMatchObject({ type, status: "SCHEDULED", enterpriseName: "Maize", plotName: "Plot B", dueOn: "2026-11-03", version: 1, createdBy: f.a.scope.actorId });
    }
    for (const type of ["VACCINATION", "FEEDING", "CLEANING", "INSPECTION"]) {
      expect(await f.a.activities.schedule(farmA(), f.command({ type, enterpriseId: f.a.poultry.id, plotId: undefined }))).toMatchObject({ type, enterpriseName: "Layers", plotId: null });
    }
    expect((await f.a.activities.list(farmA(), { limit: 5 })).items).toHaveLength(5);
  });
  it("allows farm-level work and never returns the internal request hash", async () => {
    const row = await f.a.activities.schedule(farmA(), f.command({ type: "CLEANING", enterpriseId: "", plotId: "" }));
    expect(row).toMatchObject({ enterpriseId: null, plotId: null });
    expect(row).not.toHaveProperty("requestHash");
    expect(await f.a.activities.detail(farmA(), row.activityId)).toEqual(row);
  });
  it("creates one activity under concurrent replay and conflicts on a changed retry", async () => {
    const command = f.command();
    const rows = await Promise.all([f.a.activities.schedule(farmA(), command), f.a.activities.schedule(farmA(), command)]);
    expect(rows[0]).toEqual(rows[1]);
    expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(1);
    await expect(f.a.activities.schedule(farmA(), { ...command, dueOn: "2026-11-04" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([["PLANTING", "poultry"], ["FEEDING", "crop"], ["MILKING", "crop"], ["INSPECTION", "fish"]] as const)("refuses %s on the %s enterprise and rolls back its receipt", async (type, kind) => {
    const command = f.command({ type, enterpriseId: f.a[kind].id, plotId: undefined });
    await expect(f.a.activities.schedule(farmA(), command)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
  });
  it("refuses milking at farm level", async () => {
    await expect(f.a.activities.schedule(farmA(), f.command({ type: "MILKING", enterpriseId: undefined, plotId: undefined }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("rejects foreign farms, parents, activities and page anchors without receipts", async () => {
    await expect(f.b.activities.schedule(farmA(), f.command())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.b.activities.list(farmA())).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const overrides of [{ enterpriseId: f.b.crop.id }, { plotId: f.b.plot.id }]) {
      const command = f.command(overrides);
      await expect(f.a.activities.schedule(farmA(), command)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await f.owner.auditEvent.count({ where: { requestId: command.requestId } })).toBe(0);
    }
    const foreign = await f.b.activities.schedule(f.b.scope.farmId, f.command({ type: "CLEANING", enterpriseId: undefined, plotId: undefined }));
    await expect(f.a.activities.detail(farmA(), foreign.activityId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.a.activities.list(farmA(), { cursor: foreign.activityId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(f.a.activities.capabilities(farmA(), { enterpriseId: f.b.crop.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("denies a revoked member and an enterprise that is no longer active", async () => {
    await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "REVOKED" } });
    try { await expect(f.a.activities.schedule(farmA(), f.command())).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await f.owner.farmMember.updateMany({ where: { userId: f.a.scope.actorId }, data: { status: "ACTIVE" } }); }
    await f.owner.enterprise.update({ where: { id: f.a.crop.id }, data: { status: "CLOSED" } });
    try { await expect(f.a.activities.schedule(farmA(), f.command())).rejects.toMatchObject({ code: "CONFLICT" }); }
    finally { await f.owner.enterprise.update({ where: { id: f.a.crop.id }, data: { status: "ACTIVE" } }); }
  });
  it("reports capabilities per enterprise, including clear limits for unsupported types", async () => {
    const poultry = await f.a.activities.capabilities(farmA(), { enterpriseId: f.a.poultry.id });
    expect(poultry.filter(row => row.available).map(row => row.type).sort()).toEqual(["CLEANING", "FEEDING", "INSPECTION", "VACCINATION"]);
    expect((await f.a.activities.capabilities(farmA(), { enterpriseId: f.a.fish.id })).every(row => row.reason)).toBe(true);
    expect((await f.a.activities.capabilities(farmA())).find(row => row.type === "MILKING")).toMatchObject({ available: false, reason: "NO_MVP_WORKFLOW" });
  });
  it("binds optional parents to the farm in the database policy and keeps browser roles denied", async () => {
    const data = { id: crypto.randomUUID(), tenantId: f.a.scope.tenantId, farmId: farmA(), type: "CLEANING" as const, dueOn: new Date("2026-11-03Z"), requestHash: "x", createdBy: f.a.scope.actorId };
    await expect(f.runtime.productionActivity.create({ data: { ...data, plotId: f.b.plot.id } })).rejects.toThrow();
    await expect(f.runtime.productionActivity.create({ data: { ...data, enterpriseId: f.b.crop.id } })).rejects.toThrow();
    const rows = await f.owner.$queryRaw<{ browser: boolean; delete: boolean; rls: boolean }[]>`SELECT has_table_privilege('authenticated','public."ProductionActivity"','SELECT') AS browser, has_table_privilege('myfarm_runtime','public."ProductionActivity"','DELETE') AS delete, (SELECT relrowsecurity FROM pg_class WHERE oid='public."ProductionActivity"'::regclass) AS rls`;
    expect(rows[0]).toEqual({ browser: false, delete: false, rls: true });
  });
  it("rejects malformed commands before any write", async () => {
    for (const overrides of [{ type: "MOWING" }, { dueOn: "2026-02-30" }, { enterpriseId: "not-a-uuid" }, { tenantId: f.a.scope.tenantId }, { status: "COMPLETED" }]) {
      await expect(f.a.activities.schedule(farmA(), f.command(overrides))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
});
