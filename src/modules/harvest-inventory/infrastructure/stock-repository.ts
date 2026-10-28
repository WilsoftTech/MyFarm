import "server-only";
import { Prisma, type PrismaClient, type StockOperation, type StockMovement } from "@/generated/prisma/client";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { textKey } from "@/modules/enterprises-seasons/domain/production";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { requireProductionWriteAccess, productionAfter } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { createAccountingRecord, reverseAccountingRecord } from "@/modules/farm-accounting/infrastructure/repository";
import type { StockRepository, StockOperationView } from "../contracts/stock";
import { reconstructStock, signedQuantityUnits, signedQuantityString, transferDeltas, type StockDelta } from "../domain/stock";
import { quantityUnits } from "../domain/harvest";
import { commandHash, stockDate, stockScope } from "./harvest-repository";

const view=(r:StockOperation):StockOperationView=>({operationId:r.id,type:r.type,itemId:r.itemId,quantity:r.quantity.toString(),unit:r.unit,occurredOn:r.occurredOn.toISOString().slice(0,10),reason:r.reason,accountingRecordId:r.accountingRecordId});
export const movementDelta=(r:StockMovement):StockDelta=>({itemId:r.itemId,locationId:r.locationId,quantityDelta:r.quantityDelta.toString(),occurredOn:r.occurredOn.toISOString().slice(0,10)});
async function reviewer(tx:Prisma.TransactionClient,scope:ProductionWriteScope) {
 if(!await tx.farmMember.findFirst({where:{...stockScope(scope),userId:scope.actorId,status:"ACTIVE",role:"OWNER"}}))throw new FoundationError("FORBIDDEN");
}
/** Batch before item is the common lock order for production, transfers and reversals. */
export async function lockStockItem(tx:Prisma.TransactionClient,scope:ProductionWriteScope,itemId:string) {
 const item=await tx.inventoryItem.findFirst({where:{...stockScope(scope),id:itemId}});if(!item)throw new FoundationError("FORBIDDEN");
 if(item.batchId)await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:poultry-stock:"+item.batchId},0))::text`;
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:stock-item:"+itemId},0))::text`;
 await requireProductionWriteAccess(tx,scope);return item;
}
async function validateTimeline(tx:Prisma.TransactionClient,scope:ProductionWriteScope,itemId:string,deltas:StockDelta[]) {
 const history=await tx.stockMovement.findMany({where:{...stockScope(scope),itemId}});
 const totals = reconstructStock([...history.map(movementDelta),...deltas]);
 const item = await tx.inventoryItem.findFirst({where:{...stockScope(scope),id:itemId}});
 if (item?.kind === "BIRD" && [...totals.values()].reduce((a,b)=>a+b,0n) > 2_147_483_647_000_000n) throw new FoundationError("CONFLICT");
}
export function stockRepository(db:PrismaClient):StockRepository {
 return {
  async operation(scope,id) {const row=await db.stockOperation.findFirst({where:{...stockScope(scope),id}});return row?view(row):null;},
  async operations(scope,{cursor,limit}) { const where=stockScope(scope),anchor=cursor?productionAfter(await db.stockOperation.findFirst({where:{...where,id:cursor}})):{};
   const rows=await db.stockOperation.findMany({where:{...where,...anchor},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit+1});return {items:rows.slice(0,limit).map(view),nextCursor:rows.length>limit?rows[limit-1].id:null};
  },
  async items(scope,{cursor,limit}) { const where=stockScope(scope);const anchor=cursor?productionAfter(await db.inventoryItem.findFirst({where:{...where,id:cursor}})):{};
   const rows=await db.inventoryItem.findMany({where:{...where,...anchor},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit+1});
   const ids=rows.slice(0,limit).map(r=>r.id);
   const sums=await db.stockMovement.groupBy({by:["itemId","locationId"],where:{...where,itemId:{in:ids}},_sum:{quantityDelta:true}});
   const selected=ids.flatMap(id=>sums.filter(t=>t.itemId===id).slice(0,20));
   const stores=await db.storageLocation.findMany({where:{...where,id:{in:selected.map(r=>r.locationId)}},select:{id:true,name:true}});
   return {items:rows.slice(0,limit).map(r=>({itemId:r.id,name:r.name,unit:r.unit,kind:r.kind,balancesTruncated:sums.filter(t=>t.itemId===r.id).length>20,balances:selected.filter(t=>t.itemId===r.id).map(t=>({locationId:t.locationId,locationName:stores.find(l=>l.id===t.locationId)?.name??"Store",quantity:signedQuantityString(BigInt(t._sum.quantityDelta?.mul(1_000_000).toFixed(0)??"0"))}))})),nextCursor:rows.length>limit?rows[limit-1].id:null}; },
  createItem:(scope,input)=>db.$transaction(async tx=>{
   await requireProductionWriteAccess(tx,scope);const id=crypto.randomUUID(),where=stockScope(scope);
   const replay=await claimCommandReceipt(tx,{actorId:scope.actorId,tenantId:scope.tenantId,requestId:input.requestId,action:"INVENTORY_ITEM_CREATED",targetId:id});
   await requireProductionWriteAccess(tx,scope);
   if(replay){const row=await tx.inventoryItem.findFirst({where:{...where,id:replay,name:input.name,unit:input.unit,kind:"SUPPLY",createdBy:scope.actorId}});if(!row)throw new FoundationError("CONFLICT");return {itemId:row.id,name:row.name,unit:row.unit,kind:row.kind,balances:[]};}
   if(["BIRD","EGG"].includes(input.unit))throw new FoundationError("INVALID_INPUT");
   try {const row=await tx.inventoryItem.create({data:{id,...where,name:input.name,nameKey:textKey(input.name),unit:input.unit,kind:"SUPPLY",createdBy:scope.actorId}});return {itemId:row.id,name:row.name,unit:row.unit,kind:row.kind,balances:[]};}
   catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==="P2002")throw new FoundationError("CONFLICT");throw e;}
  }),
  post:(scope,input)=>db.$transaction(async tx=>{
   await requireProductionWriteAccess(tx,scope);const id=crypto.randomUUID(),where=stockScope(scope),requestHash=commandHash(input);
   const replay=await claimCommandReceipt(tx,{actorId:scope.actorId,tenantId:scope.tenantId,requestId:input.requestId,action:"STOCK_OPERATION_POSTED",targetId:id});
   if(replay){await requireProductionWriteAccess(tx,scope);const row=await tx.stockOperation.findFirst({where:{...where,id:replay,requestHash,createdBy:scope.actorId}});if(!row)throw new FoundationError("CONFLICT");return view(row);}
   const item=await lockStockItem(tx,scope,input.itemId);
   if(input.unit!==item.unit || (["BIRD","EGG"].includes(item.unit)&&quantityUnits(input.quantity)%1_000_000n!==0n))throw new FoundationError("INVALID_INPUT");
   // Bird changes are production events; transfers conserve flock size.
   if(item.kind==="BIRD"&&input.type!=="TRANSFER")throw new FoundationError("INVALID_INPUT");
   if(input.type==="ADJUSTMENT")await reviewer(tx,scope);
   const locations=[input.locationId,...(input.destinationLocationId?[input.destinationLocationId]:[])];
   if(await tx.storageLocation.count({where:{...where,id:{in:locations}}})!==locations.length)throw new FoundationError("FORBIDDEN");
   const positive=input.type==="ADJUSTMENT"&&input.direction==="IN";
   const deltas=input.type==="TRANSFER"?transferDeltas(item.id,input.locationId,input.destinationLocationId ?? input.locationId,input.quantity,input.occurredOn):[{itemId:item.id,locationId:input.locationId,occurredOn:input.occurredOn,quantityDelta:(positive?"":"-")+input.quantity}];
   await validateTimeline(tx,scope,item.id,deltas);
   let accountingRecordId:string|undefined;
   if(input.sale){
    const cycle=item.cropCycleId?await tx.cropCycle.findFirst({where:{...where,id:item.cropCycleId}}):null;
    const batch=item.batchId?await tx.poultryBatch.findFirst({where:{...where,id:item.batchId}}):null;
    const sale=await createAccountingRecord(tx,scope,"SALE",{...input.sale,requestId:input.requestId,occurredOn:input.occurredOn,enterpriseId:cycle?.enterpriseId??batch?.enterpriseId,plotId:cycle?.plotId,seasonId:cycle?.seasonId},crypto.randomUUID());accountingRecordId=sale.recordId;
   }
   const row=await tx.stockOperation.create({data:{id,...where,type:input.type,itemId:item.id,locationId:input.locationId,destinationLocationId:input.destinationLocationId,quantity:input.quantity,unit:item.unit,occurredOn:stockDate(input.occurredOn),direction:input.direction,reason:input.reason,accountingRecordId,requestHash,createdBy:scope.actorId}});
   for(const [i,d]of deltas.entries())await tx.stockMovement.create({data:{...where,itemId:item.id,locationId:d.locationId,stockOperationId:id,quantityDelta:d.quantityDelta,reason:input.type==="TRANSFER"?(i===0?"TRANSFER_OUT":"TRANSFER_IN"):input.type==="ADJUSTMENT"?(positive?"ADJUSTMENT_IN":"ADJUSTMENT_OUT"):input.type,sourceKey:"stock:"+id+":"+i,occurredOn:row.occurredOn,createdBy:scope.actorId}});
   if(input.type==="ADJUSTMENT")await tx.stockAdjustment.create({data:{...where,operationId:id,reason:input.reason,approvedBy:scope.actorId,createdBy:scope.actorId}});
   return view(row);
  },{timeout:15_000,isolationLevel:"ReadCommitted"}),
  reverse:(scope,input)=>db.$transaction(async tx=>{
   await requireProductionWriteAccess(tx,scope);await reviewer(tx,scope);
   const where=stockScope(scope),id=crypto.randomUUID(),requestHash=commandHash(input),reversalKey=input.targetType+":"+input.targetId;
   const replay=await claimCommandReceipt(tx,{actorId:scope.actorId,tenantId:scope.tenantId,requestId:input.requestId,action:"STOCK_SOURCE_REVERSED",targetId:id});
   if(replay){await requireProductionWriteAccess(tx,scope);const prior=await tx.stockOperation.findFirst({where:{...where,id:replay,requestHash,createdBy:scope.actorId}});if(!prior)throw new FoundationError("CONFLICT");return view(prior);}
   const source=input.targetType==="HARVEST"?await tx.harvest.findFirst({where:{...where,id:input.targetId}}):input.targetType==="PRODUCTION"?await tx.productionEvent.findFirst({where:{...where,id:input.targetId}}):await tx.stockOperation.findFirst({where:{...where,id:input.targetId}});
   if(!source)throw new FoundationError("FORBIDDEN");
   if("type"in source&&source.type==="REVERSE")throw new FoundationError("INVALID_INPUT");
   const on="harvestDate"in source?source.harvestDate:source.occurredOn;
   if(input.occurredOn<on.toISOString().slice(0,10))throw new FoundationError("INVALID_INPUT");
   const movements=await tx.stockMovement.findMany({where:{...where,...(input.targetType==="HARVEST"?{harvestId:input.targetId}:input.targetType==="PRODUCTION"?{productionEventId:input.targetId}:{stockOperationId:input.targetId})}});
   const itemId=movements[0]?.itemId??null;
   if(itemId)await lockStockItem(tx,scope,itemId);
   else await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:reverse-source:"+reversalKey},0))::text`;
   await requireProductionWriteAccess(tx,scope);
   if(await tx.stockOperation.findUnique({where:{reversalKey}}))throw new FoundationError("CONFLICT");
   const deltas=movements.map(m=>({itemId:m.itemId,locationId:m.locationId,quantityDelta:signedQuantityString(-signedQuantityUnits(m.quantityDelta.toString())),occurredOn:input.occurredOn}));
   if(itemId)await validateTimeline(tx,scope,itemId,deltas);
   const finance="accountingRecordId"in source?source.accountingRecordId:null;
   if(finance)await reverseAccountingRecord(tx,scope,{requestId:input.requestId,recordType:"SALE",recordId:finance,reason:input.reason},crypto.randomUUID(),true);
   const row=await tx.stockOperation.create({data:{id,...where,type:"REVERSE",itemId,quantity:source.quantity,unit:source.unit,occurredOn:stockDate(input.occurredOn),reason:input.reason,targetType:input.targetType,targetId:input.targetId,reversalKey,requestHash,createdBy:scope.actorId}});
   for(const [i,d]of deltas.entries())await tx.stockMovement.create({data:{...where,itemId:d.itemId,locationId:d.locationId,quantityDelta:d.quantityDelta,stockOperationId:id,reversalOfId:movements[i].id,reason:"REVERSAL",sourceKey:"reversal:"+movements[i].id,occurredOn:row.occurredOn,createdBy:scope.actorId}});
   return view(row);
  },{timeout:15_000,isolationLevel:"ReadCommitted"}),
 };
}
