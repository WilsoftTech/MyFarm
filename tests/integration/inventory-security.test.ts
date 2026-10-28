import { beforeAll,afterAll,it,expect } from "vitest";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";
import { StockService } from "@/modules/harvest-inventory/application/stock";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
let a:Awaited<ReturnType<typeof inventoryFixture>>,b:Awaited<ReturnType<typeof inventoryFixture>>,stock:StockService,itemId:string,sameTenantFarm:string;
const id=()=>crypto.randomUUID();
beforeAll(async()=>{
 a=await inventoryFixture();b=await inventoryFixture();stock=new StockService(a.auth,registryRepository(a.runtime),stockRepository(a.runtime));
 itemId=(await a.harvest.record(a.scope.farmId,a.command())).itemId;
 const original=await a.owner.farm.findUniqueOrThrow({where:{id:a.scope.farmId}});
 const farm=await a.owner.farm.create({data:{id:id(),tenantId:a.scope.tenantId,ownerFarmerId:original.ownerFarmerId,name:"Second farm",district:"Rukungiri",ownershipType:"OWNED",primaryActivity:"CROPS",createdBy:a.scope.actorId}});sameTenantFarm=farm.id;
 await a.owner.farmMember.create({data:{tenantId:a.scope.tenantId,farmId:farm.id,userId:a.scope.actorId,role:"OWNER"}});
},30_000);
afterAll(async()=>{
 if(b){await b.owner.farmMember.deleteMany({where:{tenantId:a.scope.tenantId,userId:b.scope.actorId}});await b.owner.membership.deleteMany({where:{organizationId:a.scope.tenantId,userId:b.scope.actorId}});await b.cleanup();}
 if(a)await a.cleanup();
});
const command=()=>({requestId:id(),itemId,locationId:a.location.storageLocationId,type:"LOSS",quantity:"1",unit:"KG",occurredOn:"2026-10-01",reason:"Damaged stock"});
it("denies both cross-tenant and same-tenant nested item/location references",async()=>{
 await expect(a.harvest.record(a.scope.farmId,{...b.command(),requestId:id()})).rejects.toMatchObject({code:"FORBIDDEN"});
 await expect(stock.post(sameTenantFarm,command())).rejects.toMatchObject({code:"FORBIDDEN"});
 await expect(stock.post(a.scope.farmId,{...command(),locationId:b.location.storageLocationId})).rejects.toMatchObject({code:"FORBIDDEN"});
 await expect(b.harvest.detail(b.scope.farmId,(await a.harvest.list(a.scope.farmId)).items[0].harvestId)).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("does not grant farm data through ADMIN even with a farm membership",async()=>{
 await b.owner.membership.create({data:{userId:b.scope.actorId,organizationId:a.scope.tenantId,role:"ADMIN"}});
 await b.owner.farmMember.create({data:{userId:b.scope.actorId,tenantId:a.scope.tenantId,farmId:a.scope.farmId,role:"OWNER"}});
 await expect(b.harvest.list(a.scope.farmId)).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("binds normalized retries to the original farm and strips internal hashes from DTOs",async()=>{
 const c=command(),one=await stock.post(a.scope.farmId,c);
 await expect(stock.post(sameTenantFarm,c)).rejects.toMatchObject({code:"CONFLICT"});
 await expect(stock.post(a.scope.farmId,{...c,reason:"Changed intent"})).rejects.toMatchObject({code:"CONFLICT"});
 expect(await stock.post(a.scope.farmId,c)).toEqual(one);
 expect((await a.harvest.list(a.scope.farmId)).items[0]).not.toHaveProperty("requestHash");
});
it("rechecks membership after waiting on stock locks and rolls back the receipt",async()=>{
 const lock=new Client({connectionString:process.env.TEST_DATABASE_URL});await lock.connect();await lock.query("BEGIN");
 const key="myfarm:stock-item:"+itemId;
 await lock.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[key]);
 const c=command();
 const pending=stock.post(a.scope.farmId,c).then(()=>"unexpected success",e=>e.code);
 try {
  let waiting=false;
  for(let i=0;i<100;i++){
   const r=await a.owner.$queryRaw<{waiting:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%' AND pid<>pg_backend_pid()) AS waiting`;
   if(r[0].waiting){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,20));
  }
  expect(waiting).toBe(true);
  await a.owner.farmMember.updateMany({where:{farmId:a.scope.farmId,userId:a.scope.actorId},data:{status:"REVOKED"}});
  await lock.query("COMMIT");expect(await pending).toBe("FORBIDDEN");
  expect(await a.owner.auditEvent.count({where:{requestId:c.requestId}})).toBe(0);
 } finally {await lock.query("ROLLBACK");await pending;await lock.end();await a.owner.farmMember.updateMany({where:{farmId:a.scope.farmId,userId:a.scope.actorId},data:{status:"ACTIVE"}});}
});
