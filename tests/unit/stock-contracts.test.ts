import { it, expect } from "vitest";
import { stockOperationSchema, reverseStockSchema } from "@/modules/harvest-inventory/contracts/stock";
import { reconstructStock, transferDeltas } from "@/modules/harvest-inventory/domain/stock";
const id = () => crypto.randomUUID();
const itemId=id(), locationId=id(), date="2026-10-01";
const m=(quantityDelta:string,occurredOn=date)=>({itemId,locationId,quantityDelta,occurredOn});
it("reconstructs the independent inventory source fixture 2400-1000-200-50=1150",()=>{
 expect(reconstructStock([m("2400"),m("-1000"),m("-200"),m("-50")]).get(itemId+":"+locationId)).toBe(1_150_000_000n);
});
it("conserves exact transfer quantities without mixing stores",()=>{
 const destination=id(), deltas=transferDeltas(itemId,locationId,destination,"0.2",date);
 const result=reconstructStock([m("0.3"),...deltas]);
 expect(result.get(itemId+":"+locationId)).toBe(100_000n);expect(result.get(itemId+":"+destination)).toBe(200_000n);
});
it("rejects historically negative stock even when a later receipt would mask it",()=>{
 expect(()=>reconstructStock([m("1","2026-10-02"),m("-1","2026-10-01")])).toThrow(expect.objectContaining({code:"CONFLICT"}));
});
it("groups same-date atomic harvest and loss without depending on UUID ordering",()=>{
 expect(reconstructStock([m("-150"),m("2400")]).get(itemId+":"+locationId)).toBe(2_250_000_000n);
});
it("rejects ambiguous operations and requires explicit reversal confirmation",()=>{
 const base={requestId:id(),itemId,locationId,type:"TRANSFER",quantity:"1",unit:"KG",occurredOn:date,reason:"Move to new store"};
 expect(stockOperationSchema.safeParse(base).success).toBe(false);
 expect(stockOperationSchema.safeParse({...base,destinationLocationId:id()}).success).toBe(true);
 expect(stockOperationSchema.safeParse({...base,type:"LOSS",direction:"IN"}).success).toBe(false);
 expect(reverseStockSchema.safeParse({requestId:id(),targetType:"HARVEST",targetId:id(),reason:"Wrong entry",occurredOn:date}).success).toBe(false);
});
