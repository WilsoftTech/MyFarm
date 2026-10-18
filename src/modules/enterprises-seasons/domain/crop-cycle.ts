import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { isNonNegativeDecimal, type AreaUnit } from "@/modules/farmer-registry/domain/rules";
import { assertCropCycleParents, assertSameFarm, isCalendarDate, type CropCycleLinks, type EnterpriseReference, type FarmScope, type PlotReference, type ProductionStatus, type SeasonReference } from "./production";

export interface CropCycleFields extends CropCycleLinks {
  cropId: string;
  variety?: string;
  areaPlanted: string;
  areaUnit: AreaUnit;
  plantingDate: string;
  expectedHarvest?: string;
  areaExceptionReason?: string;
}
export interface CropCatalogReference { cropId: string; name: string; active: boolean }
export interface CropPlotReference extends PlotReference { area: string | null; areaUnit: AreaUnit | null }
export interface CropCycleParents {
  enterprise: EnterpriseReference;
  season: SeasonReference;
  plot: CropPlotReference;
  crop: CropCatalogReference;
}
export interface CropAreaAllocation extends FarmScope {
  cycleId: string;
  plotId: string;
  areaPlanted: string;
  areaUnit: AreaUnit;
  status: ProductionStatus;
}

const scale = 1_000_000n;
/** Registry-compatible numeric(18,6), represented exactly without binary floating point. */
function areaUnits(value: string): bigint {
  if (!isNonNegativeDecimal(value, 12, 6)) throw new FoundationError("INVALID_INPUT");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, "0"));
}
function areaString(value: bigint): string {
  const fraction = (value % scale).toString().padStart(6, "0").replace(/0+$/, "");
  return (value / scale).toString() + (fraction ? "." + fraction : "");
}
export function normalizePlantedArea(value: string): string | null {
  if (!isNonNegativeDecimal(value, 12, 6)) return null;
  const units = areaUnits(value);
  return units > 0n ? areaString(units) : null;
}
export function isCropDateRange(plantingDate: string, expectedHarvest?: string): boolean {
  return isCalendarDate(plantingDate) && (expectedHarvest === undefined || (isCalendarDate(expectedHarvest) && expectedHarvest >= plantingDate));
}

/**
 * Deterministic relationship/capacity rule, NOT authentication or a concurrency lock.
 * Caller supplies the complete plot allocation set from an authorized write transaction.
 * ACTIVE cycles reserve area until explicitly closed; a harvest forecast never releases it.
 */
export function assertCropCycleStart(scope: FarmScope, fields: CropCycleFields, parents: CropCycleParents, allocations: readonly CropAreaAllocation[]): { totalAreaPlanted: string; exceedsPlotArea: boolean } {
  assertCropCycleParents(scope, fields, parents);
  if (parents.crop.cropId !== fields.cropId) throw new FoundationError("INVALID_INPUT");
  if (!parents.crop.active) throw new FoundationError("CONFLICT");
  if (!isCropDateRange(fields.plantingDate, fields.expectedHarvest)) throw new FoundationError("INVALID_INPUT");
  if (parents.plot.area === null || parents.plot.areaUnit === null || fields.areaUnit !== parents.plot.areaUnit) throw new FoundationError("INVALID_INPUT");
  let total = areaUnits(fields.areaPlanted);
  if (total === 0n) throw new FoundationError("INVALID_INPUT");
  const capacity = areaUnits(parents.plot.area), seen = new Set<string>();
  for (const allocation of allocations) {
    assertSameFarm(scope, [allocation]);
    if (allocation.plotId !== fields.plotId) throw new FoundationError("FORBIDDEN");
    if (seen.has(allocation.cycleId)) throw new FoundationError("INVALID_INPUT");
    seen.add(allocation.cycleId);
    if (allocation.status === "CLOSED") continue;
    if (allocation.areaUnit !== fields.areaUnit) throw new FoundationError("INVALID_INPUT");
    const units = areaUnits(allocation.areaPlanted);
    if (units === 0n) throw new FoundationError("INVALID_INPUT");
    total += units;
  }
  const exceedsPlotArea = total > capacity;
  if (exceedsPlotArea && !fields.areaExceptionReason?.trim()) throw new FoundationError("INVALID_INPUT");
  return { totalAreaPlanted: areaString(total), exceedsPlotArea };
}
