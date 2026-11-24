import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";
import { CooperativeService } from "@/modules/cooperatives/application/cooperative";
import { cooperativeRepository } from "@/modules/cooperatives/infrastructure/repository";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
const request = () => ({ requestId: crypto.randomUUID(), confirmed: true as const });
describe("Phase 15 organization consent, procurement and ledgers on real PostgreSQL", () => {
  let f: Awaited<ReturnType<typeof inventoryFixture>>, g: typeof f;
  let manager: CooperativeService, farmer: CooperativeService, buyer: CooperativeService, agent: CooperativeService;
  let org: string, foreign: string, share: string, buyerId: string, agentId: string, harvestId: string;
  const orgs: string[] = [], extraUsers: string[] = [];
  beforeAll(async () => {
    f = await inventoryFixture(); g = await inventoryFixture();
    manager = new CooperativeService(f.auth, cooperativeRepository(f.runtime)); farmer = new CooperativeService(g.auth, cooperativeRepository(f.runtime));
    org = crypto.randomUUID(); foreign = crypto.randomUUID(); orgs.push(org, foreign);
    await manager.create({ ...request(), organizationId: org, name: "Consented cooperative" });
    await farmer.create({ ...request(), organizationId: foreign, name: "Other organization" });
    async function invite(userId: string, role: string, service: CooperativeService) {
      const receipt = await manager.relationship(org, { ...request(), type: "INVITE", userId, role });
      await service.relationship(org, { ...request(), type: "ACCEPT", memberId: receipt.targetId, expectedVersion: receipt.version });
    }
    await invite(g.scope.actorId, "FARMER", farmer);
    async function newActor(role: string) {
      const subject = crypto.randomUUID(), user = await f.owner.user.create({ data: { authSubject: subject } }); extraUsers.push(user.id);
      const service = new CooperativeService(new AuthorizationService({ currentIdentity: async () => ({ authSubject: subject }) }, identityRepository(f.runtime)), cooperativeRepository(f.runtime));
      await invite(user.id, role, service); return { service, id: user.id };
    }
    const b = await newActor("BUYER"); buyer = b.service; buyerId = b.id;
    const a = await newActor("AGENT"); agent = a.service; agentId = a.id;
    share = (await farmer.relationship(org, { ...request(), type: "SHARE", farmId: g.scope.farmId, shareLocation: false, shareProduction: true })).targetId;
    harvestId = (await g.harvest.record(g.scope.farmId, g.command())).harvestId;
  }, 120_000);
  afterAll(async () => {
    if (!f) return;
    for (const organizationId of orgs) {
      for (const table of ["CooperativeReceipt", "CooperativeEntry", "CooperativeForecast", "CooperativeLot", "CooperativeShare", "CooperativeMember"]) await f.owner.$executeRawUnsafe('DELETE FROM "' + table + '" WHERE "organizationId"=$1::uuid', organizationId);
      await f.owner.auditEvent.deleteMany({ where: { tenantId: organizationId } });
      await f.owner.organization.deleteMany({ where: { id: organizationId } });
    }
    await f.owner.user.deleteMany({ where: { id: { in: extraUsers } } });
    await f.cleanup(); await g.cleanup();
  });
  const procure = (extra: Record<string, unknown> = {}) => ({ ...request(), type: "PROCURE", shareId: share, harvestId, product: "Maize", unit: "KG", quantity: "10", unitPrice: "2000", currency: "UGX", grade: "A", location: "Main store", occurredOn: "2026-11-24", ...extra });
  async function newLot() { return (await manager.operation(org, procure())).targetId; }
  it("creates exactly one organization/manager/audit under racing identical retries and rejects changed payload", async () => {
    const organizationId = crypto.randomUUID(); orgs.push(organizationId);
    const command = { ...request(), organizationId, name: "Replay bootstrap" };
    const [a, b] = await Promise.all([manager.create(command), manager.create(command)]);
    expect(a).toEqual(b); expect(await f.owner.cooperativeMember.count({ where: { organizationId } })).toBe(1);
    expect(await f.owner.auditEvent.count({ where: { tenantId: organizationId, requestId: command.requestId } })).toBe(1);
    await expect(manager.create({ ...command, name: "Changed" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("requires invitation acceptance, current account and distinct institutional permission", async () => {
    expect((await buyer.list()).find(row => row.id === org)?.member.role).toBe("BUYER");
    expect(await f.owner.farmMember.count({ where: { userId: buyerId } })).toBe(0);
    expect(await f.owner.cooperativeReceipt.count({ where: { organizationId: org, action: "INVITE_BUYER" } })).toBe(1);
    await expect(buyer.operation(org, procure())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(agent.operation(org, procure())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(farmer.operation(org, procure())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(manager.read(foreign, "members")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const invite = await manager.relationship(org, { ...request(), type: "INVITE", userId: f.scope.actorId, role: "BUYER" }).catch(error => error);
    expect(invite).toMatchObject({ code: "CONFLICT" });
  });
  it("does not let a manager consent for another farmer or accept another user's invitation", async () => {
    await expect(manager.relationship(org, { ...request(), type: "SHARE", farmId: g.scope.farmId, shareLocation: true, shareProduction: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const me = (await manager.read(org, "members")).members.find(row => row.userId === g.scope.actorId)!;
    await expect(manager.relationship(org, { ...request(), type: "ACCEPT", memberId: me.id, expectedVersion: me.version })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("shares minimal fields, hides optional coordinates, and never returns private finances or phone numbers", async () => {
    await g.owner.farm.update({ where: { id: g.scope.farmId }, data: { latitude: "-0.8", longitude: "29.9" } });
    const view = await manager.read(org, "farms");
    expect(view.farms).toEqual([expect.objectContaining({ id: share, name: "Inventory farm", latitude: null, longitude: null })]);
    expect(JSON.stringify(view)).not.toMatch(/phone|authSubject|AccountingRecord|unitPrice/);
    expect((await agent.read(org, "farms")).farms).toHaveLength(1);
    expect(await f.owner.officerAssignment.count({ where: { officerId: agentId } })).toBe(0);
  });
  it("labels exact declared forecasts by unit and window and rejects guessed share IDs", async () => {
    const command = { ...request(), type: "FORECAST", shareId: share, product: "Maize", unit: "KG", quantity: "10.123456", harvestFrom: "2026-12-01", harvestTo: "2026-12-31" };
    await farmer.operation(org, command);
    expect((await manager.read(org, "forecasts")).forecastTotals).toContainEqual({ product: "Maize", unit: "KG", quantity: "10.123456", harvestFrom: "2026-12-01", harvestTo: "2026-12-31" });
    await expect(farmer.operation(org, { ...command, ...request(), shareId: crypto.randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(farmer.operation(org, { ...command, ...request(), harvestFrom: "2027-01-01" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("atomically posts one procurement/stock/audit through racing retries, preserving farmer stock", async () => {
    const stockBefore = await g.owner.stockMovement.count({ where: { farmId: g.scope.farmId } });
    const command = procure(); const [a, b] = await Promise.all([manager.operation(org, command), manager.operation(org, command)]);
    expect(a).toEqual(b);
    expect(await f.owner.cooperativeLot.count({ where: { id: a.targetId } })).toBe(1);
    expect(await f.owner.cooperativeEntry.count({ where: { lotId: a.targetId } })).toBe(1);
    expect(await g.owner.stockMovement.count({ where: { farmId: g.scope.farmId } })).toBe(stockBefore);
    await expect(manager.operation(org, { ...command, quantity: "11" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("denies nested origin, lot and operation IDOR, with no receipt or partial record", async () => {
    const foreignHarvest = (await f.harvest.record(f.scope.farmId, f.command())).harvestId;
    const invited = await farmer.relationship(foreign, { ...request(), type: "INVITE", userId: f.scope.actorId, role: "FARMER" });
    await manager.relationship(foreign, { ...request(), type: "ACCEPT", memberId: invited.targetId, expectedVersion: invited.version });
    const foreignShare = (await manager.relationship(foreign, { ...request(), type: "SHARE", farmId: f.scope.farmId, shareLocation: false, shareProduction: true })).targetId;
    const foreignLot = (await farmer.operation(foreign, procure({ shareId: foreignShare, harvestId: foreignHarvest }))).targetId;
    for (const command of [procure({ harvestId: foreignHarvest }), procure({ shareId: foreignShare }), { ...request(), type: "PAYMENT", lotId: foreignLot, amount: "1", currency: "UGX", reference: "Test", occurredOn: "2026-11-24" }, { ...request(), type: "REVERSE", operationId: foreignLot, reason: "Test" }]) {
      await expect(manager.operation(org, command)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(await f.owner.cooperativeReceipt.count({ where: { requestId: command.requestId } })).toBe(0);
    }
    const collision = procure(), before = await f.owner.cooperativeLot.count({ where: { organizationId: org } });
    await f.owner.auditEvent.create({ data: { actorId: f.scope.actorId, tenantId: org, action: "COOP_PROCURE", requestId: collision.requestId, targetId: crypto.randomUUID() } });
    await expect(manager.operation(org, collision)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await f.owner.cooperativeLot.count({ where: { organizationId: org } })).toBe(before);
  });
  it("serializes concurrent stock issues so only one can consume the remaining quantity", async () => {
    const lotId = await newLot();
    const issue = () => ({ ...request(), type: "RELEASE", lotId, quantity: "7", location: "Main store", reason: "Delivered", occurredOn: "2026-11-24" });
    const result = await Promise.allSettled([manager.operation(org, issue()), manager.operation(org.toUpperCase(), issue())]);
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await manager.read(org, "lots")).inventory.find(r => r.lotId === lotId)?.quantity).toBe("3");
  });
  it("serializes payment retries and prevents overpayment and currency mismatch", async () => {
    const lotId = await newLot(), payment = { ...request(), type: "PAYMENT", lotId, amount: "15000", currency: "UGX", reference: "Receipt 1", occurredOn: "2026-11-24" };
    const [a, b] = await Promise.all([manager.operation(org, payment), manager.operation(org, payment)]); expect(a).toEqual(b);
    await expect(manager.operation(org, { ...payment, ...request(), amount: "6000" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(manager.operation(org, { ...payment, ...request(), amount: "1", currency: "USD" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await manager.read(org, "lots")).payments.find(p => p.lotId === lotId)?.outstanding).toBe("5000");
  });
  it("transfers conserve stock; a linked reversal restores both stores atomically", async () => {
    const lotId = await newLot();
    const moved = await manager.operation(org, { ...request(), type: "MOVE", lotId, quantity: "3", from: "Main store", to: "Depot", occurredOn: "2026-11-24" });
    expect((await manager.read(org, "lots")).inventory.filter(r => r.lotId === lotId).map(r => r.quantity).sort()).toEqual(["3", "7"]);
    await manager.operation(org, { ...request(), type: "REVERSE", operationId: moved.targetId, reason: "Wrong store" });
    expect((await manager.read(org, "lots")).inventory.filter(r => r.lotId === lotId).map(r => r.quantity).sort()).toEqual(["0", "10"]);
    await expect(manager.operation(org, { ...request(), type: "REVERSE", operationId: moved.targetId, reason: "Again" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("preserves money and source history, requiring payment reversal before procurement reversal", async () => {
    const lotId = await newLot();
    const paid = await manager.operation(org, { ...request(), type: "PAYMENT", lotId, amount: "1", currency: "UGX", reference: "Receipt", occurredOn: "2026-11-24" });
    await expect(manager.operation(org, { ...request(), type: "REVERSE", operationId: lotId, reason: "Wrong receipt" })).rejects.toMatchObject({ code: "CONFLICT" });
    await manager.operation(org, { ...request(), type: "REVERSE", operationId: paid.targetId, reason: "Wrong payment" });
    await manager.operation(org, { ...request(), type: "REVERSE", operationId: lotId, reason: "Wrong receipt" });
    expect((await manager.read(org, "lots")).payments.find(r => r.lotId === lotId)).toMatchObject({ obligation: "0", paid: "0", outstanding: "0" });
    expect(await f.owner.cooperativeEntry.count({ where: { lotId } })).toBe(4);
  });
  it("buyers see only explicitly published product/unit/current stock, with no origin, prices or finance", async () => {
    expect((await buyer.read(org, "lots")).published).toEqual([]);
    const lotId = await newLot();
    await manager.operation(org, { ...request(), type: "PUBLISH", lotId, expectedVersion: 1, published: true });
    const view = await buyer.read(org, "lots"); expect(view.published).toEqual([{ product: "Maize", unit: "KG", quantity: "10" }]);
    expect(JSON.stringify(view)).not.toContain(share); expect(JSON.stringify(view)).not.toContain(harvestId); expect(view.payments).toEqual([]); expect(view.lots).toEqual([]); expect(view.entries).toEqual([]); expect(view.members).toEqual([]);
    await expect(buyer.read(org, "members")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await manager.operation(org, { ...request(), type: "PUBLISH", lotId, expectedVersion: 2, published: false });
    expect((await buyer.read(org, "lots")).published).toEqual([]);
  });
  it("rejects guessed/foreign pagination cursors rather than using them as a scope bypass", async () => {
    await expect(manager.read(org, "farms", crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(agent.read(org, "lots")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await farmer.read(org, "members")).members).toEqual([]);
  });
  it("paginates shared estimates without duplicates and excludes foreign organization anchors", async () => {
    await f.owner.cooperativeForecast.createMany({ data: Array.from({ length: 52 }, () => ({ organizationId: org, shareId: share, createdBy: g.scope.actorId, product: "Sorghum", unit: "KG", quantity: "1", harvestFrom: new Date("2026-12-01Z"), harvestTo: new Date("2026-12-31Z") })) });
    const first = await manager.read(org, "forecasts"); expect(first.forecasts).toHaveLength(50); expect(first.nextCursor).not.toBeNull();
    const second = await manager.read(org, "forecasts", first.nextCursor);
    expect(second.forecasts.length).toBeGreaterThan(0);
    expect(second.forecasts.some(row => first.forecasts.some(prior => prior.id === row.id))).toBe(false);
  });
  it("keeps tables inaccessible to browsers and runtime ledger/receipt edits denied", async () => {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
    try {
      for (const role of ["anon", "authenticated"]) {
        await db.query('SET ROLE ' + role);
        await expect(db.query('SELECT * FROM "CooperativeLot"')).rejects.toMatchObject({ code: "42501" });
        await db.query('RESET ROLE');
      }
      await db.query('SET ROLE myfarm_runtime');
      for (const table of ["CooperativeEntry", "CooperativeReceipt"]) await expect(db.query('DELETE FROM "' + table + '" WHERE false')).rejects.toMatchObject({ code: "42501" });
      await expect(db.query('UPDATE "CooperativeLot" SET total=0 WHERE false')).rejects.toMatchObject({ code: "42501" });
      await db.query('RESET ROLE');
    } finally { await db.end(); }
  });
  it("enforces parent scope and exact numerical constraints in the database", async () => {
    await expect(f.owner.cooperativeLot.create({ data: { organizationId: foreign, shareId: share, createdBy: f.scope.actorId, product: "Bad", unit: "KG", quantity: "1", unitPrice: "1", currency: "UGX", total: "1", grade: "", occurredOn: new Date("2026-11-24Z") } })).rejects.toThrow();
    await expect(manager.operation(org, procure({ unit: "EGG", quantity: "0.5", harvestId: null }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const foreignOrigin = await f.owner.harvest.findFirstOrThrow({ where: { farmId: f.scope.farmId } });
    await expect(f.runtime.cooperativeLot.create({ data: { organizationId: org, shareId: share, harvestId: foreignOrigin.id, createdBy: f.scope.actorId, product: "Maize", unit: "KG", quantity: "1", unitPrice: "1", currency: "UGX", total: "1", grade: "", occurredOn: new Date("2026-11-24Z") } })).rejects.toThrow(/row-level security/i);
  });
  it("refuses suspended accounts and expired sessions before any write", async () => {
    await f.owner.user.update({ where: { id: buyerId }, data: { status: "SUSPENDED" } });
    try { await expect(buyer.read(org, "lots")).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await f.owner.user.update({ where: { id: buyerId }, data: { status: "ACTIVE" } }); }
    const expired = new CooperativeService(new AuthorizationService({ currentIdentity: async () => null }, identityRepository(f.runtime)), cooperativeRepository(f.runtime));
    await expect(expired.operation(org, procure())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("current farm owner eligibility is required on every organization read and procurement", async () => {
    await g.owner.farmMember.updateMany({ where: { farmId: g.scope.farmId }, data: { status: "REVOKED" } });
    try { expect((await manager.read(org, "farms")).farms).toEqual([]); await expect(manager.operation(org, procure())).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await g.owner.farmMember.updateMany({ where: { farmId: g.scope.farmId }, data: { status: "ACTIVE" } }); }
  });
  it("rechecks current farm permission after a queued mutation waits for its organization lock", async () => {
    const holder = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await holder.connect();
    const command = procure(); let waiting: Promise<unknown> | undefined;
    try {
      await holder.query("BEGIN"); await holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["cooperative:" + org]);
      waiting = manager.operation(org, command).then(value => ({ value }), (error: unknown) => ({ code: error instanceof FoundationError ? error.code : "UNAVAILABLE" }));
      let blocked = false;
      for (let attempt = 0; attempt < 50 && !blocked; attempt++) {
        blocked = (await holder.query<{ blocked: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) AS blocked")).rows[0].blocked;
        if (!blocked) await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      // Simulate an independent owner-access revocation while the command is blocked.
      await g.owner.farmMember.updateMany({ where: { farmId: g.scope.farmId }, data: { status: "REVOKED" } });
      await holder.query("COMMIT");
      expect(await waiting).toMatchObject({ code: "FORBIDDEN" });
      expect(await f.owner.cooperativeReceipt.count({ where: { requestId: command.requestId } })).toBe(0);
    } finally {
      await holder.query("ROLLBACK"); await holder.end();
      if (waiting) await waiting;
      await g.owner.farmMember.updateMany({ where: { farmId: g.scope.farmId }, data: { status: "ACTIVE" } });
    }
  });
  it("withdrawn sharing immediately stops future reads/forecasts/procurement, preserving owned history", async () => {
    const command = procure(); await manager.operation(org, command);
    const withdrawn = { ...request(), type: "REVOKE_SHARE", shareId: share, expectedVersion: 1 };
    expect(await farmer.relationship(org, withdrawn)).toEqual(await farmer.relationship(org, withdrawn));
    expect((await manager.read(org, "farms")).farms).toEqual([]); expect((await manager.read(org, "forecasts")).forecasts).toEqual([]);
    await expect(manager.operation(org, command)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await manager.read(org, "lots")).lots.length).toBeGreaterThan(0);
  });
  it("last manager protection and membership revocation/re-invitation never restore old sharing", async () => {
    const suspended = await f.owner.user.create({ data: { authSubject: crypto.randomUUID(), status: "SUSPENDED" } }); extraUsers.push(suspended.id);
    const suspendedMember = await f.owner.cooperativeMember.create({ data: { organizationId: org, userId: suspended.id, invitedBy: f.scope.actorId, role: "MANAGER", status: "ACTIVE" } });
    await manager.relationship(org, { ...request(), type: "REVOKE_MEMBER", memberId: suspendedMember.id, expectedVersion: 1 });
    const managerRow = (await manager.read(org, "members")).members.find(m => m.userId === f.scope.actorId)!;
    await expect(manager.relationship(org, { ...request(), type: "REVOKE_MEMBER", memberId: managerRow.id, expectedVersion: managerRow.version })).rejects.toMatchObject({ code: "CONFLICT" });
    const farmerRow = (await manager.read(org, "members")).members.find(m => m.userId === g.scope.actorId)!;
    await manager.relationship(org, { ...request(), type: "REVOKE_MEMBER", memberId: farmerRow.id, expectedVersion: farmerRow.version });
    await expect(farmer.read(org, "farms")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const invite = await manager.relationship(org, { ...request(), type: "INVITE", userId: g.scope.actorId, role: "FARMER" });
    await farmer.relationship(org, { ...request(), type: "ACCEPT", memberId: invite.targetId, expectedVersion: invite.version });
    expect((await farmer.read(org, "farms")).farms).toEqual([]);
  });
});
