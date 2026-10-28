import { beforeAll,afterAll,it,expect } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { ReconstructionService } from "@/modules/harvest-inventory/application/reconstruction";
import { reconstructionRepository } from "@/modules/harvest-inventory/infrastructure/reconstruction-repository";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
let f:Awaited<ReturnType<typeof inventoryFixture>>,service:ReconstructionService,itemId:string;
beforeAll(async()=>{f=await inventoryFixture();service=new ReconstructionService(f.auth,registryRepository(f.runtime),reconstructionRepository(f.runtime));itemId=(await f.harvest.record(f.scope.farmId,f.command())).itemId;},30_000);
afterAll(async()=>{if(f)await f.cleanup();});
it("reconstructs every store in one snapshot and pages output without truncating calculation",async()=>{
 const dest=await f.harvest.createLocation(f.scope.farmId,{requestId:crypto.randomUUID(),name:"Dry store"});
 const repo=stockRepository(f.runtime);
 await repo.post(f.scope,{requestId:crypto.randomUUID(),itemId,locationId:f.location.storageLocationId,type:"TRANSFER",quantity:"650",unit:"KG",occurredOn:"2026-10-01",reason:"Transfer",destinationLocationId:dest.storageLocationId});
 const first=await service.reconstruct(f.scope.farmId,itemId,{limit:1});expect(first.matches).toBe(true);expect(first.balances).toHaveLength(1);expect(first.nextCursor).not.toBeNull();
 const second=await service.reconstruct(f.scope.farmId,itemId,{limit:1,cursor:first.nextCursor});expect(second.matches).toBe(true);
 expect([...first.balances,...second.balances].map(b=>b.quantity).sort()).toEqual(["1600","650"]);
 const display=(await repo.items(f.scope,{limit:100})).items.find(i=>i.itemId===itemId);
 expect(display?.balances.map(b=>b.quantity).sort()).toEqual(["1600","650"]);
 expect(await f.owner.auditEvent.count({where:{targetId:itemId,action:"INVENTORY_RECONSTRUCTED"}})).toBe(2);
});
it("keeps archived crop/closed cycle history readable and validates nested history cursors",async()=>{
 await f.owner.cropCycle.update({where:{id:f.cycle.id},data:{status:"CLOSED"}});
 const page=await service.history(f.scope.farmId,itemId,{limit:1});expect(page.items).toHaveLength(1);expect(page.nextCursor).not.toBeNull();
 expect((await service.history(f.scope.farmId,itemId,{limit:1,cursor:page.nextCursor})).items).toHaveLength(1);
 expect((await service.reconstruct(f.scope.farmId,itemId)).matches).toBe(true);
 await expect(service.history(f.scope.farmId,itemId,{cursor:crypto.randomUUID()})).rejects.toMatchObject({code:"INVALID_INPUT"});
 await expect(service.reconstruct(f.scope.farmId,crypto.randomUUID())).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("denies revoked membership before reading reconstruction/history",async()=>{
 await f.owner.farmMember.updateMany({where:{userId:f.scope.actorId},data:{status:"REVOKED"}});
 try{await expect(service.reconstruct(f.scope.farmId,itemId)).rejects.toMatchObject({code:"FORBIDDEN"});await expect(service.history(f.scope.farmId,itemId)).rejects.toMatchObject({code:"FORBIDDEN"});}
 finally{await f.owner.farmMember.updateMany({where:{userId:f.scope.actorId},data:{status:"ACTIVE"}});}
});
