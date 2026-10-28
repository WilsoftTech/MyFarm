import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";

let f: Awaited<ReturnType<typeof inventoryFixture>>;
beforeAll(async () => { f = await inventoryFixture(); }, 30_000);
afterAll(async () => { if (f) await f.cleanup(); });
describe("harvest authorized persistence", () => {
  it("posts separate gross and loss movements exactly once under concurrent replay", async () => {
    const cmd = f.command();
    const rows = await Promise.all([f.harvest.record(f.scope.farmId, cmd), f.harvest.record(f.scope.farmId, cmd)]);
    expect(rows[0]).toEqual(rows[1]); expect(rows[0].storedQuantity).toBe("2250");
    expect(await f.owner.stockMovement.count({ where: { harvestId: rows[0].harvestId } })).toBe(2);
    expect((await f.harvest.detail(f.scope.farmId, rows[0].harvestId)).quantity).toBe("2400");
    await expect(f.harvest.record(f.scope.farmId, { ...cmd, quantity: "2401" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await f.owner.auditEvent.count({ where: { requestId: cmd.requestId } })).toBe(1);
  });
  it("rolls back receipts and all effects for wrong nested references", async () => {
    const cmd = { ...f.command(), plotId: crypto.randomUUID() };
    const n = await f.owner.harvest.count({ where: { tenantId: f.scope.tenantId } });
    await expect(f.harvest.record(f.scope.farmId, cmd)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await f.owner.auditEvent.count({ where: { requestId: cmd.requestId } })).toBe(0);
    expect(await f.owner.harvest.count({ where: { tenantId: f.scope.tenantId } })).toBe(n);
  });
  it("rejects foreign farms, parent IDs, page anchors and revoked membership", async () => {
    await expect(f.harvest.list(crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.harvest.detail(f.scope.farmId, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(f.harvest.list(f.scope.farmId, { cursor: crypto.randomUUID() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await f.owner.farmMember.updateMany({ where: { userId: f.scope.actorId }, data: { status: "REVOKED" } });
    try { await expect(f.harvest.record(f.scope.farmId, f.command())).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await f.owner.farmMember.updateMany({ where: { userId: f.scope.actorId }, data: { status: "ACTIVE" } }); }
  });
  it("allows zero stored stock after full loss and forbids catalog crop mismatch", async () => {
    expect((await f.harvest.record(f.scope.farmId, { ...f.command(), lossQuantity: "2400" })).storedQuantity).toBe("0");
    await expect(f.harvest.record(f.scope.farmId, { ...f.command(), cropId: crypto.randomUUID() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("keeps browser roles denied and runtime stock append-only", async () => {
    const rows = await f.owner.$queryRaw<{ browser: boolean; update: boolean; delete: boolean }[]>`SELECT has_table_privilege('authenticated','public."Harvest"','SELECT') AS browser, has_table_privilege('myfarm_runtime','public."StockMovement"','UPDATE') AS update, has_table_privilege('myfarm_runtime','public."StockMovement"','DELETE') AS delete`;
    expect(rows[0]).toEqual({ browser: false, update: false, delete: false });
  });
  it("keeps named storage unique and replays creation", async () => {
    const cmd = { requestId: crypto.randomUUID(), name: "Second store" };
    expect(await f.harvest.createLocation(f.scope.farmId, cmd)).toEqual(await f.harvest.createLocation(f.scope.farmId, cmd));
    await expect(f.harvest.createLocation(f.scope.farmId, { ...cmd, requestId: crypto.randomUUID(), name: " second STORE " })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
