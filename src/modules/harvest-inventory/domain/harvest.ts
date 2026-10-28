import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isNonNegativeDecimal } from "@/modules/farmer-registry/domain/rules";
import { assertSameFarm, isCalendarDate, type FarmScope, type PlotReference } from "@/modules/enterprises-seasons/domain/production";

const scale = 1_000_000n;
/** Exact numeric(18,6) quantities. No binary floating point or implicit unit conversion. */
export function quantityUnits(value: string): bigint {
  if (!isNonNegativeDecimal(value, 12, 6)) throw new FoundationError("INVALID_INPUT");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, "0"));
}
export function quantityString(value: bigint): string {
  if (value < 0n) throw new FoundationError("INVALID_INPUT");
  const fraction = (value % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return (value / scale).toString() + (fraction ? "." + fraction : "");
}
export function normalizeHarvestQuantity(value: string): string | null {
  if (!isNonNegativeDecimal(value, 12, 6)) return null;
  return quantityString(quantityUnits(value));
}

export interface HarvestFields {
  cropCycleId: string;
  cropId: string;
  plotId: string;
  storageLocationId: string;
  harvestDate: string;
  quantity: string;
  unit: "KG";
  grade?: string;
  lossQuantity: string;
}
export interface HarvestCycleReference extends FarmScope {
  cropCycleId: string;
  cropId: string;
  plotId: string;
  plantingDate: string;
}
export interface StorageLocationReference extends FarmScope { storageLocationId: string; name: string }
export interface HarvestParents {
  cycle: HarvestCycleReference;
  plot: PlotReference;
  storage: StorageLocationReference;
}

/** Pure relationship/quantity rules; the service must authenticate and load scoped parents. */
export function assertHarvest(scope: FarmScope, fields: HarvestFields, parents: HarvestParents): { storedQuantity: string } {
  assertSameFarm(scope, [parents.cycle, parents.plot, parents.storage]);
  if (parents.cycle.cropCycleId !== fields.cropCycleId || parents.plot.plotId !== fields.plotId ||
      parents.cycle.plotId !== fields.plotId || parents.storage.storageLocationId !== fields.storageLocationId) {
    throw new FoundationError("FORBIDDEN");
  }
  if (parents.cycle.cropId !== fields.cropId || fields.unit !== "KG" || !parents.storage.name.trim()) throw new FoundationError("INVALID_INPUT");
  if (!isCalendarDate(fields.harvestDate) || !isCalendarDate(parents.cycle.plantingDate) || fields.harvestDate < parents.cycle.plantingDate) throw new FoundationError("INVALID_INPUT");
  const gross = quantityUnits(fields.quantity), loss = quantityUnits(fields.lossQuantity);
  if (gross === 0n || loss > gross) throw new FoundationError("INVALID_INPUT");
  return { storedQuantity: quantityString(gross - loss) };
}

/** Source harvest reconciliation, not a stock ledger or authorization/concurrency check. */
export function remainingHarvestQuantity(harvested: string, sold: string, lost: string): string {
  const remaining = quantityUnits(harvested) - quantityUnits(sold) - quantityUnits(lost);
  if (remaining < 0n) throw new FoundationError("CONFLICT");
  return quantityString(remaining);
}
