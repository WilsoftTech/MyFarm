import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { quantityString, quantityUnits } from "./harvest";

export interface StockDelta { itemId: string; locationId: string; occurredOn: string; quantityDelta: string }
export function signedQuantityUnits(value: string): bigint {
  return value.startsWith("-") ? -quantityUnits(value.slice(1)) : quantityUnits(value);
}
export function signedQuantityString(value: bigint): string { return value < 0n ? "-" + quantityString(-value) : quantityString(value); }
/** Balances and every effective-date closing balance derive from movement history. */
export function reconstructStock(movements: readonly StockDelta[]): Map<string, bigint> {
  const daily = new Map<string, Map<string, bigint>>();
  for (const m of movements) {
    if (!isCalendarDate(m.occurredOn)) throw new FoundationError("INVALID_INPUT");
    const key = m.itemId + ":" + m.locationId;
    const dates = daily.get(key) ?? new Map<string, bigint>();
    dates.set(m.occurredOn, (dates.get(m.occurredOn) ?? 0n) + signedQuantityUnits(m.quantityDelta)); daily.set(key, dates);
  }
  const balances = new Map<string, bigint>();
  for (const [key, dates] of daily) {
    let total = 0n;
    for (const date of [...dates.keys()].sort()) {
      total += dates.get(date) ?? 0n;
      if (total < 0n) throw new FoundationError("CONFLICT");
    }
    balances.set(key, total);
  }
  return balances;
}
export function transferDeltas(itemId: string, from: string, to: string, quantity: string, occurredOn: string): StockDelta[] {
  if (from === to || quantityUnits(quantity) <= 0n) throw new FoundationError("INVALID_INPUT");
  return [{ itemId, locationId: from, quantityDelta: "-" + quantity, occurredOn }, { itemId, locationId: to, quantityDelta: quantity, occurredOn }];
}
