import { beforeAll, afterAll, it, expect } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { PoultryProductionService } from "@/modules/harvest-inventory/application/production";
import { poultryProductionRepository } from "@/modules/harvest-inventory/infrastructure/production-repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { StockService } from "@/modules/harvest-inventory/application/stock";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
let f: Awaited<ReturnType<typeof inventoryFixture>>, service: PoultryProductionService, batchId: string, categoryId: string;
beforeAll(async () => {
 f = await inventoryFixture(); service = new PoultryProductionService(f.auth, registryRepository(f.runtime), poultryProductionRepository(f.runtime));
 const e = await f.owner.enterprise.create({ data: { tenantId: f.scope.tenantId, farmId: f.scope.farmId, name: "Poultry", type: "POULTRY", createdBy: f.scope.actorId } });
 const animal = await f.owner.animalTypeCatalog.findFirstOrThrow();
 const b = await f.owner.poultryBatch.create({ data: { tenantId: f.scope.tenantId, farmId: f.scope.farmId, enterpriseId: e.id, animalTypeId: animal.id, animalTypeName: animal.name,
  batchLabel: "P".repeat(120), batchLabelKey: "p".repeat(120), startingQuantity: 100, acquisitionDate: new Date("2026-03-01Z"), purpose: "DUAL_PURPOSE", createdBy: f.scope.actorId } }); batchId = b.id;
 categoryId = (await f.owner.transactionCategory.findFirstOrThrow({ where: { kind: "REVENUE", active: true } })).id;
}, 30_000);
afterAll(async () => { if (f) await f.cleanup(); });
const cmd = (type = "PURCHASE", quantity = "20", unit = "BIRD") => ({ requestId: crypto.randomUUID(), batchId, locationId: f.location.storageLocationId, type, quantity, unit, occurredOn: "2026-10-01" });
it("atomically reconstructs source flock, sale and independent egg stock without duplicate opening", async () => {
 await service.record(f.scope.farmId, cmd());
 await service.record(f.scope.farmId, cmd("MORTALITY", "5"));
 const sale = { ...cmd("BIRD_SALE", "10"), sale: { categoryId, amount: "200000", currency: "UGX" } };
 const [a,b] = await Promise.all([service.record(f.scope.farmId, sale), service.record(f.scope.farmId, sale)]); expect(a).toEqual(b);
 await service.record(f.scope.farmId, cmd("EGGS", "30", "EGG"));
 await service.record(f.scope.farmId, cmd("FEED", "2.5", "KG"));
 await service.record(f.scope.farmId, cmd("MEDICATION", "2", "ML"));
 expect((await service.summary(f.scope.farmId, batchId)).currentQuantity).toBe(105);
 expect(await f.owner.stockMovement.count({ where: { openingBatchId: batchId } })).toBe(1);
 expect(await f.owner.accountingRecord.count({ where: { tenantId: f.scope.tenantId, kind: "SALE" } })).toBe(1);
 const egg = await f.owner.inventoryItem.findFirstOrThrow({ where: { batchId, kind: "EGG" } });
 expect((await f.owner.stockMovement.aggregate({ where: { itemId: egg.id }, _sum: { quantityDelta: true } }))._sum.quantityDelta?.toString()).toBe("30");
});
it("serializes competing mortality and rolls back the loser", async () => {
 const results = await Promise.allSettled([service.record(f.scope.farmId, cmd("MORTALITY", "100")), service.record(f.scope.farmId, cmd("MORTALITY", "100"))]);
 expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
 expect((await service.summary(f.scope.farmId, batchId)).currentQuantity).toBe(5);
});
it("rolls back financial and stock effects when sale validation fails and rejects nested foreign IDs", async () => {
 const c = { ...cmd("BIRD_SALE", "1"), sale: { categoryId: crypto.randomUUID(), amount: "2", currency: "UGX" } };
 await expect(service.record(f.scope.farmId, c)).rejects.toMatchObject({ code: "INVALID_INPUT" });
 expect(await f.owner.auditEvent.count({ where: { requestId: c.requestId } })).toBe(0);
 await expect(service.record(f.scope.farmId, { ...cmd(), locationId: crypto.randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
 await expect(service.summary(f.scope.farmId, crypto.randomUUID())).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("reverses a bird sale with one stock return and one financial reversal", async () => {
 const source=await f.owner.productionEvent.findFirstOrThrow({where:{batchId,type:"BIRD_SALE"}});
 const stock=new StockService(f.auth,registryRepository(f.runtime),stockRepository(f.runtime));
 const c={requestId:crypto.randomUUID(),targetType:"PRODUCTION",targetId:source.id,reason:"Correct bird sale",occurredOn:"2026-10-01",confirmed:true};
 const [a,b]=await Promise.all([stock.reverse(f.scope.farmId,c),stock.reverse(f.scope.farmId,c)]);expect(a).toEqual(b);
 expect((await service.summary(f.scope.farmId,batchId)).currentQuantity).toBe(15);
 const events=await service.events(f.scope.farmId,batchId,{limit:1});expect(events.nextCursor).not.toBeNull();expect((await service.event(f.scope.farmId,source.id)).reversed).toBe(true);
 expect(await f.owner.accountingReversal.count({where:{recordId:source.accountingRecordId}})).toBe(1);
});
