import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { reconstructStock, signedQuantityString, type StockDelta } from "./stock";

export interface BalanceProjection { itemId: string; locationId: string; quantity: string }
/** Aggregate totals can exceed one numeric(18,6) movement; keep them exact too. */
function balanceUnits(value: string): bigint {
  if (!/^-?\d{1,100}(?:\.\d{1,6})?$/.test(value)) throw new FoundationError("INVALID_INPUT");
  const negative = value.startsWith("-"), [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return negative ? -units : units;
}
/** The ledger wins over a stale/corrupt projection. Never repair history to match a cache. */
export function reconcileStock(projection: readonly BalanceProjection[], history: readonly StockDelta[]) {
  const rebuilt = reconstructStock(history), actual = new Map<string, bigint>();
  for (const row of projection) {
    const key = row.itemId + ":" + row.locationId;
    if (actual.has(key)) throw new FoundationError("INVALID_INPUT");
    actual.set(key, balanceUnits(row.quantity));
  }
  const keys = new Set([...rebuilt.keys(), ...actual.keys()]);
  return { matches: [...keys].every(key => (actual.get(key) ?? 0n) === (rebuilt.get(key) ?? 0n)),
    balances: [...rebuilt].sort(([a], [b]) => a.localeCompare(b)).map(([key, quantity]) => {
      const [itemId, locationId] = key.split(":");
      return { itemId, locationId, quantity: signedQuantityString(quantity) };
    }) };
}
