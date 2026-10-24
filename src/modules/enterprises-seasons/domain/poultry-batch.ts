import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { assertPoultryBatchParent, isCalendarDate, type EnterpriseReference, type FarmScope, type PoultryBatchLinks } from "./production";

/** PostgreSQL integer maximum; bird counts are whole numbers (D-P03-003). */
export const MAX_BIRD_COUNT = 2_147_483_647;
/** Phase 3 has no bird movements, so the starting count is the only provenance. Phase 5 adds movement-derived sources. */
export const BATCH_QUANTITY_SOURCES = ["STARTING_QUANTITY"] as const;
export type BatchQuantitySource = typeof BATCH_QUANTITY_SOURCES[number];
export interface BatchQuantity { quantity: number; source: BatchQuantitySource }

export interface PoultryBatchFields extends PoultryBatchLinks {
  batchName: string;
  animalType: string;
  breed?: string;
  startingQuantity: number;
  acquisitionDate: string;
  purpose: string;
}

export function isBirdCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_BIRD_COUNT;
}
/** Digits only: signs, decimals, exponents and separators are rejected rather than rounded. */
export function normalizeBirdCount(value: string): number | null {
  if (!/^\d{1,10}$/.test(value)) return null;
  const count = Number(value);
  return isBirdCount(count) ? count : null;
}

/** Use only with an enterprise looked up under an authenticated, currently authorized farm. */
export function assertPoultryBatchStart(scope: FarmScope, fields: PoultryBatchFields, enterprise: EnterpriseReference): void {
  assertPoultryBatchParent(scope, fields, enterprise);
  if (!isBirdCount(fields.startingQuantity) || !isCalendarDate(fields.acquisitionDate)) throw new FoundationError("INVALID_INPUT");
  if (![fields.batchName, fields.animalType, fields.purpose].every(value => value.trim())) throw new FoundationError("INVALID_INPUT");
}

/** Current quantity is derived, never an overwritten field; it carries where the number came from. */
export function currentBatchQuantity(batch: { startingQuantity: number }): BatchQuantity {
  if (!isBirdCount(batch.startingQuantity)) throw new FoundationError("INVALID_INPUT");
  return { quantity: batch.startingQuantity, source: "STARTING_QUANTITY" };
}
