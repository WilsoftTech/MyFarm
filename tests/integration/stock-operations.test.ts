import { beforeAll, afterAll, it, expect } from "vitest";
import { inventoryFixture } from "../support/inventory-fixture";
import { StockService } from "@/modules/harvest-inventory/application/stock";
import { stockRepository } from "@/modules/harvest-inventory/infrastructure/stock-repository";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { recordPaymentSchema } from "@/modules/farm-accounting/contracts/accounting";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
let f: Awaited<ReturnType<typeof inventoryFixture>>, stock:StockService, categoryId:string;
const id=()=>crypto.randomUUID();
beforeAll(async()=>{f=await inventoryFixture();stock=new StockService(f.auth,registryRepository(f.runtime),stockRepository(f.runtime));categoryId=(await f.owner.transactionCategory.findFirstOrThrow({where:{kind:"REVENUE",active:true}})).id;},30_000);
afterAll(async()=>{if(f)await f.cleanup();});
async function harvested(lossQuantity="0") {
 const store=await f.harvest.createLocation(f.scope.farmId,{requestId:id(),name:"Store "+id()});
 const harvest=await f.harvest.record(f.scope.farmId,{...f.command(),lossQuantity,storageLocationId:store.storageLocationId});
 return {harvest,locationId:store.storageLocationId,itemId:harvest.itemId};
}
const input=(itemId:string,locationId:string,type="LOSS",quantity="1")=>({requestId:id(),itemId,locationId,type,quantity,unit:"KG",occurredOn:"2026-10-01",reason:"Verified fixture operation"});
async function balance(itemId:string,locationId:string){return (await f.owner.stockMovement.aggregate({where:{itemId,locationId},_sum:{quantityDelta:true}}))._sum.quantityDelta?.toString()??"0";}
it("keeps the harvest source oracle separate: 2400-1600-150=650",async()=>{
 const r=await harvested("150");const c={...input(r.itemId,r.locationId,"SALE","1600"),sale:{categoryId,amount:"200000",currency:"UGX"}};
 const [a,b]=await Promise.all([stock.post(f.scope.farmId,c),stock.post(f.scope.farmId,c)]);expect(a).toEqual(b);
 expect(await balance(r.itemId,r.locationId)).toBe("650");
 expect(await f.owner.accountingRecord.count({where:{id:a.accountingRecordId??undefined}})).toBe(1);
});
it("proves the independent ledger oracle and transfer conservation",async()=>{
 const r=await harvested();
 await stock.post(f.scope.farmId,{...input(r.itemId,r.locationId,"SALE","1000"),sale:{categoryId,amount:"1000",currency:"UGX"}});
 await stock.post(f.scope.farmId,{...input(r.itemId,r.locationId,"SALE","200"),sale:{categoryId,amount:"200",currency:"UGX"}});
 await stock.post(f.scope.farmId,{...input(r.itemId,r.locationId,"LOSS","50"),reason:"Damage"});
 expect(await balance(r.itemId,r.locationId)).toBe("1150");
 const dest=await f.harvest.createLocation(f.scope.farmId,{requestId:id(),name:"Transfer "+id()});
 const transfer=await stock.post(f.scope.farmId,{...input(r.itemId,r.locationId,"TRANSFER","650"),destinationLocationId:dest.storageLocationId});
 expect(await balance(r.itemId,r.locationId)).toBe("500");expect(await balance(r.itemId,dest.storageLocationId)).toBe("650");
 const loss=await stock.post(f.scope.farmId,input(r.itemId,dest.storageLocationId,"LOSS","600"));
 const reversal=(targetId:string)=>({requestId:id(),targetType:"OPERATION",targetId,reason:"Correct entry",occurredOn:"2026-10-01",confirmed:true});
 await expect(stock.reverse(f.scope.farmId,reversal(transfer.operationId))).rejects.toMatchObject({code:"CONFLICT"});
 await stock.reverse(f.scope.farmId,reversal(loss.operationId));
 await stock.reverse(f.scope.farmId,reversal(transfer.operationId));
 expect(await balance(r.itemId,r.locationId)).toBe("1150");expect(await balance(r.itemId,dest.storageLocationId)).toBe("0");
});
it("serializes competing withdrawals and rejects backdated shortages",async()=>{
 const r=await harvested();
 const results=await Promise.allSettled([stock.post(f.scope.farmId,input(r.itemId,r.locationId,"LOSS","2000")),stock.post(f.scope.farmId,input(r.itemId,r.locationId,"LOSS","2000"))]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(await balance(r.itemId,r.locationId)).toBe("400");
 await expect(stock.post(f.scope.farmId,{...input(r.itemId,r.locationId),occurredOn:"2026-09-30"})).rejects.toMatchObject({code:"CONFLICT"});
});
it("coordinates sale reversal, requires payment reversal first and appends once",async()=>{
 const r=await harvested();const sale=await stock.post(f.scope.farmId,{...input(r.itemId,r.locationId,"SALE","10"),sale:{categoryId,amount:"100",currency:"UGX"}});
 const finance=farmAccountingRepository(f.runtime), recordId=sale.accountingRecordId;
 if(!recordId)throw new Error("Sale record missing");
 await expect(finance.reverse(f.scope,{requestId:id(),recordType:"SALE",recordId,reason:"Wrong"})).rejects.toMatchObject({code:"CONFLICT"});
 const method=await f.owner.paymentMethod.findFirstOrThrow();
 const payment=await finance.recordPayment(f.scope,recordPaymentSchema.parse({requestId:id(),direction:"RECEIVED",amount:"50",currency:"UGX",paidOn:"2026-10-01",paymentMethodId:method.id,allocations:[{obligationId:recordId,amount:"50"}]}));
 const c={requestId:id(),targetType:"OPERATION",targetId:sale.operationId,reason:"Wrong sale",occurredOn:"2026-10-01",confirmed:true};
 await expect(stock.reverse(f.scope.farmId,c)).rejects.toMatchObject({code:"CONFLICT"});
 expect(await f.owner.auditEvent.count({where:{requestId:c.requestId}})).toBe(0);
 await finance.reverse(f.scope,{requestId:id(),recordType:"PAYMENT",recordId:payment.paymentId,reason:"Correct payment first"});
 const [a,b]=await Promise.all([stock.reverse(f.scope.farmId,c),stock.reverse(f.scope.farmId,c)]);expect(a).toEqual(b);
 expect((await f.owner.accountingRecord.findUniqueOrThrow({where:{id:recordId}})).status).toBe("REVERSED");expect(await balance(r.itemId,r.locationId)).toBe("2400");
 await expect(stock.reverse(f.scope.farmId,{...c,requestId:id()})).rejects.toMatchObject({code:"CONFLICT"});
});
it("reverses a harvest without rewriting source history and rejects incompatible units and foreign parents",async()=>{
 const r=await harvested("150");const original=await f.owner.harvest.findUniqueOrThrow({where:{id:r.harvest.harvestId}});
 await stock.reverse(f.scope.farmId,{requestId:id(),targetType:"HARVEST",targetId:original.id,reason:"Wrong harvest",occurredOn:"2026-10-01",confirmed:true});
 expect(await balance(r.itemId,r.locationId)).toBe("0");expect(await f.owner.harvest.findUniqueOrThrow({where:{id:original.id}})).toEqual(original);
 await expect(stock.post(f.scope.farmId,{...input(r.itemId,r.locationId),unit:"BAG"})).rejects.toMatchObject({code:"INVALID_INPUT"});
 await expect(stock.post(f.scope.farmId,{...input(r.itemId,r.locationId),locationId:id()})).rejects.toMatchObject({code:"FORBIDDEN"});
});
it("creates explicitly unit-labelled supplies with owner-reviewed opening adjustments",async()=>{
 const item=await stock.createItem(f.scope.farmId,{requestId:id(),name:"Feed",unit:"KG"});
 await stock.post(f.scope.farmId,{...input(item.itemId,f.location.storageLocationId,"ADJUSTMENT","100"),direction:"IN"});
 expect(await balance(item.itemId,f.location.storageLocationId)).toBe("100");
 expect(await f.owner.stockAdjustment.count({where:{tenantId:f.scope.tenantId}})).toBeGreaterThan(0);
});
