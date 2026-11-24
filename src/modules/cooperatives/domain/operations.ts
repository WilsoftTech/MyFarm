import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { moneyString, moneyUnits } from "@/modules/farm-accounting/domain/money";
import { quantityString, quantityUnits } from "@/modules/harvest-inventory/domain/harvest";
import { reconstructStock, signedQuantityUnits } from "@/modules/harvest-inventory/domain/stock";
import type { EntryView, ForecastTotal, ForecastView, InventoryAggregate, InventoryTotal, LotView, PaymentTotal } from "../contracts/cooperative";

/** Price x quantity, rounded half up once to the existing four-place money precision. */
export function procurementTotal(quantity: string, unitPrice: string, unit: string): string {
  const q = quantityUnits(quantity);
  if (q <= 0n || (unit !== "KG" && (unit !== "EGG" && unit !== "BIRD" || q % 1_000_000n !== 0n))) throw new FoundationError("INVALID_INPUT");
  const total = (q * moneyUnits(unitPrice) + 500_000n) / 1_000_000n;
  if (total <= 0n) throw new FoundationError("INVALID_INPUT");
  // Revalidate precision/overflow against numeric(20,4).
  const result = moneyString(total); moneyUnits(result); return result;
}
function signedMoney(value: string) { return value.startsWith("-") ? -moneyUnits(value.slice(1)) : moneyUnits(value); }
export function organizationReport(lots: readonly LotView[], entries: readonly EntryView[]): { inventory: InventoryTotal[]; inventoryAggregates: InventoryAggregate[]; payments: PaymentTotal[] } {
  const byId = new Map(lots.map(lot => [lot.id, lot]));
  if (byId.size !== lots.length || new Set(entries.map(e => e.id)).size !== entries.length) throw new FoundationError("CONFLICT");
  const acquisitions = new Map<string, EntryView[]>(), paidTotals = new Map<string, bigint>(), reversedIds = new Set<string>();
  for (const e of entries) {
    const lot = byId.get(e.lotId);
    if (!lot || e.unit !== lot.unit || e.currency !== lot.currency || (e.kind === "STOCK" ? signedMoney(e.amountDelta) !== 0n : signedQuantityUnits(e.quantityDelta) !== 0n)) throw new FoundationError("CONFLICT");
    if (e.kind === "STOCK" && lot.unit !== "KG" && signedQuantityUnits(e.quantityDelta) % 1_000_000n !== 0n) throw new FoundationError("CONFLICT");
    if (e.reversalOfId) reversedIds.add(e.reversalOfId);
    if (e.kind === "STOCK" && e.operationId === lot.id && e.reversalOfId === null) acquisitions.set(lot.id, [...(acquisitions.get(lot.id) ?? []), e]);
    if (e.kind === "PAYMENT") paidTotals.set(lot.id, (paidTotals.get(lot.id) ?? 0n) + signedMoney(e.amountDelta));
  }
  const stock = reconstructStock(entries.filter(e => e.kind === "STOCK").map(e => ({ itemId: e.lotId, locationId: e.location, quantityDelta: e.quantityDelta, occurredOn: e.occurredOn })));
  const inventory = [...stock].map(([key, q]) => {
    const separator = key.indexOf(":"), lotId = key.slice(0, separator), location = key.slice(separator + 1), lot = byId.get(lotId);
    if (!lot) throw new FoundationError("CONFLICT");
    return { lotId, product: lot.product, unit: lot.unit, location, quantity: quantityString(q) };
  });
  const payments = lots.map(lot => {
    const received = acquisitions.get(lot.id) ?? [];
    if (received.length !== 1 || signedQuantityUnits(received[0].quantityDelta) !== quantityUnits(lot.quantity)) throw new FoundationError("CONFLICT");
    const reversed = reversedIds.has(received[0].id);
    const obligation = reversed ? 0n : moneyUnits(lot.total);
    const paid = paidTotals.get(lot.id) ?? 0n;
    if (paid < 0n || paid > obligation) throw new FoundationError("CONFLICT");
    return { lotId: lot.id, currency: lot.currency, obligation: moneyString(obligation), paid: moneyString(paid), outstanding: moneyString(obligation - paid) };
  });
  const grouped = new Map<string, { row: InventoryTotal; units: bigint }>();
  for (const row of inventory) {
    const key = JSON.stringify([row.product, row.unit, row.location]), previous = grouped.get(key);
    grouped.set(key, { row, units: (previous?.units ?? 0n) + quantityUnits(row.quantity) });
  }
  const inventoryAggregates = [...grouped.values()].map(({ row, units }) => ({ product: row.product, unit: row.unit, location: row.location, quantity: quantityString(units) }));
  return { inventory, inventoryAggregates, payments };
}
export function declaredForecasts(rows: readonly ForecastView[]): ForecastTotal[] {
  const totals = new Map<string, { row: ForecastView; units: bigint }>();
  for (const row of rows) {
    if (row.harvestFrom > row.harvestTo || (row.unit !== "KG" && quantityUnits(row.quantity) % 1_000_000n !== 0n)) throw new FoundationError("INVALID_INPUT");
    const key = JSON.stringify([row.product, row.unit, row.harvestFrom, row.harvestTo]);
    const previous = totals.get(key); totals.set(key, { row, units: (previous?.units ?? 0n) + quantityUnits(row.quantity) });
  }
  return [...totals.values()].map(({ row, units }) => ({ product: row.product, unit: row.unit, harvestFrom: row.harvestFrom, harvestTo: row.harvestTo, quantity: quantityString(units) }));
}
