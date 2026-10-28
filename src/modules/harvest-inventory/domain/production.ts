import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { quantityUnits } from "./harvest";

export const PRODUCTION_EVENT_TYPES = ["PURCHASE", "MORTALITY", "EGGS", "FEED", "MEDICATION", "BIRD_SALE"] as const;
export type ProductionEventType = typeof PRODUCTION_EVENT_TYPES[number];
export interface FlockEvent { type: ProductionEventType; quantity: string; unit: string; occurredOn: string }
export function assertProductionQuantity(event: FlockEvent): void {
  if (!PRODUCTION_EVENT_TYPES.includes(event.type)) throw new FoundationError("INVALID_INPUT");
  const q = quantityUnits(event.quantity);
  if (q <= 0n || !isCalendarDate(event.occurredOn)) throw new FoundationError("INVALID_INPUT");
  if (["PURCHASE", "MORTALITY", "BIRD_SALE"].includes(event.type) && (event.unit !== "BIRD" || q % 1_000_000n !== 0n)) throw new FoundationError("INVALID_INPUT");
  if (event.type === "EGGS" && (event.unit !== "EGG" || q % 1_000_000n !== 0n)) throw new FoundationError("INVALID_INPUT");
  if (event.type === "FEED" && event.unit !== "KG") throw new FoundationError("INVALID_INPUT");
  if (event.type === "MEDICATION" && (!event.unit.trim() || event.unit.length > 20 || ["BIRD", "EGG"].includes(event.unit))) throw new FoundationError("INVALID_INPUT");
}
/** Opening count is counted once; egg/feed/medication events do not change flock size. */
export function reconstructFlock(starting: number, events: readonly FlockEvent[]): number {
  if (!Number.isInteger(starting) || starting < 0 || starting > 2_147_483_647) throw new FoundationError("INVALID_INPUT");
  let total = BigInt(starting);
  for (const event of events) {
    assertProductionQuantity(event);
    const q = quantityUnits(event.quantity) / 1_000_000n;
    if (event.type === "PURCHASE") total += q;
    if (event.type === "MORTALITY" || event.type === "BIRD_SALE") total -= q;
  }
  if (total < 0n || total > 2_147_483_647n) throw new FoundationError("CONFLICT");
  return Number(total);
}
