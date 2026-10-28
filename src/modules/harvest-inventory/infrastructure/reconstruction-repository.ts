import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { requireProductionWriteAccess, productionAfter } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { stockScope } from "./harvest-repository";
import { movementDelta } from "./stock-repository";
import { reconcileStock } from "../domain/reconstruction";
import type { ReconstructionRepository } from "../contracts/reconstruction";

export function reconstructionRepository(db:PrismaClient):ReconstructionRepository {
 return {
  reconstruct:(scope,itemId,{cursor,limit})=>db.$transaction(async tx=>{
   await requireProductionWriteAccess(tx,scope);const where=stockScope(scope);
   const item=await tx.inventoryItem.findFirst({where:{...where,id:itemId}});if(!item)throw new FoundationError("FORBIDDEN");
   // Both independent calculations see one snapshot, including all locations and history.
   const history=await tx.stockMovement.findMany({where:{...where,itemId}});
   const totals=await tx.stockMovement.groupBy({by:["locationId"],where:{...where,itemId},_sum:{quantityDelta:true}});
   const result=reconcileStock(totals.map(t=>({itemId,locationId:t.locationId,quantity:t._sum.quantityDelta?.toString()??"0"})),history.map(movementDelta));
   const start=cursor?result.balances.findIndex(r=>r.locationId===cursor)+1:0;if(cursor&&start===0)throw new FoundationError("INVALID_INPUT");
   const selected=result.balances.slice(start,start+limit),more=result.balances.length>start+limit;
   const stores=await tx.storageLocation.findMany({where:{...where,id:{in:selected.map(r=>r.locationId)}},select:{id:true,name:true}});
   await tx.auditEvent.create({data:{actorId:scope.actorId,tenantId:scope.tenantId,action:"INVENTORY_RECONSTRUCTED",targetId:itemId,requestId:crypto.randomUUID()}});
   return {itemId,name:item.name,unit:item.unit,asOf:new Date().toISOString(),matches:result.matches,balances:selected.map(r=>({locationId:r.locationId,locationName:stores.find(s=>s.id===r.locationId)?.name??"Store",quantity:r.quantity})),nextCursor:more?selected[selected.length-1].locationId:null};
  },{isolationLevel:"RepeatableRead",timeout:15_000}),
  async history(scope,itemId,{cursor,limit}) {
   const where=stockScope(scope);
   if(!await db.inventoryItem.findFirst({where:{...where,id:itemId},select:{id:true}}))throw new FoundationError("FORBIDDEN");
   const anchor=cursor?productionAfter(await db.stockMovement.findFirst({where:{...where,itemId,id:cursor}})):{};
   const rows=await db.stockMovement.findMany({where:{...where,itemId,...anchor},include:{location:{select:{name:true}},item:{select:{name:true,unit:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit+1});
   return {items:rows.slice(0,limit).map(r=>({unit:r.item.unit,itemName:r.item.name,movementId:r.id,locationId:r.locationId,locationName:r.location.name,quantityDelta:r.quantityDelta.toString(),reason:r.reason,occurredOn:r.occurredOn.toISOString().slice(0,10),createdAt:r.createdAt.toISOString()})),nextCursor:rows.length>limit?rows[limit-1].id:null};
  },
 };
}
