import { it, expect } from "vitest";
import { reconcileStock } from "@/modules/harvest-inventory/domain/reconstruction";
const base={itemId:crypto.randomUUID(),locationId:crypto.randomUUID()},occurredOn="2026-10-01";
const ledger=[{...base,occurredOn,quantityDelta:"2400"},{...base,occurredOn,quantityDelta:"-1250"}];
it("detects a corrupted display and recomputes it solely from immutable movements",()=>{
 const wrong=[{...base,quantity:"9999"}];
 const result=reconcileStock(wrong,ledger);expect(result.matches).toBe(false);expect(result.balances).toEqual([{...base,quantity:"1150"}]);
 expect(reconcileStock(result.balances,ledger).matches).toBe(true);expect(wrong[0].quantity).toBe("9999");
});
it("retains zero-history locations and exact aggregates above individual movement precision",()=>{
 const other=crypto.randomUUID();const h=[{...base,occurredOn,quantityDelta:"999999999999.999999"},{...base,occurredOn,quantityDelta:"0.000001"},{...base,locationId:other,occurredOn,quantityDelta:"1"},{...base,locationId:other,occurredOn,quantityDelta:"-1"}];
 const result=reconcileStock([{...base,quantity:"1000000000000"},{...base,locationId:other,quantity:"0"}],h);
 expect(result.matches).toBe(true);expect(result.balances).toHaveLength(2);
});
it("does not silently accept duplicate, malformed or missing projections",()=>{
 expect(reconcileStock([],ledger).matches).toBe(false);
 expect(()=>reconcileStock([{...base,quantity:"1e3"}],ledger)).toThrow();
 expect(()=>reconcileStock([{...base,quantity:"1"},{...base,quantity:"1"}],ledger)).toThrow();
});
