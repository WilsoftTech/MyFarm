import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { assertPoultryBatchParent, displayText, isCalendarDate, textKey, type EnterpriseReference, type FarmScope, type PoultryBatchLinks } from "./production";

export const POULTRY_PURPOSES = ["EGGS", "MEAT", "DUAL_PURPOSE", "BREEDING"] as const;
export type PoultryPurpose = typeof POULTRY_PURPOSES[number];
/** PostgreSQL integer upper bound; bird counts are whole numbers (D-P03-003). */
export const MAX_BIRD_COUNT = 2_147_483_647;
/** Until Phase 5 flock movements exist, the current count is the recorded starting count. */
export const CURRENT_QUANTITY_SOURCES = ["STARTING_COUNT"] as const;
export type CurrentQuantitySource = typeof CURRENT_QUANTITY_SOURCES[number];

export interface PoultryBatchFields extends PoultryBatchLinks {
  animalTypeId: string;
  breed?: string;
  batchLabel: string;
  startingQuantity: number;
  acquisitionDate: string;
  purpose: PoultryPurpose;
}
export interface AnimalTypeCatalogReference { animalTypeId: string; name: string; active: boolean }
export interface PoultryBatchParents { enterprise: EnterpriseReference; animalType: AnimalTypeCatalogReference }

/** Digits only (leading zeros allowed) or a safe JS integer; fractions, signs and exponents fail. */
export function normalizeBirdCount(value: unknown): number | null {
  const count = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isSafeInteger(count) && count >= 0 && count <= MAX_BIRD_COUNT ? count + 0 : null;
}
/** Display label: trimmed, internal whitespace collapsed; the farmer's capitalization is kept. */
export function normalizeBatchLabel(value: string): string {
  return displayText(value);
}
/** Farm-wide identity key: "Batch  #004" and "batch #004" are the same batch label. */
export function batchLabelKey(value: string): string {
  return textKey(value);
}
export function currentQuantity(startingQuantity: number): { currentQuantity: number; currentQuantitySource: CurrentQuantitySource } {
  return { currentQuantity: startingQuantity, currentQuantitySource: "STARTING_COUNT" };
}

/**
 * Deterministic parent/catalog/value rule, NOT authentication or label-uniqueness enforcement.
 * Callers supply parents looked up under current authorization; the repository enforces the
 * farm-wide label key (all statuses) inside the write transaction.
 */
export function assertPoultryBatchStart(scope: FarmScope, fields: PoultryBatchFields, parents: PoultryBatchParents): void {
  assertPoultryBatchParent(scope, fields, parents.enterprise);
  if (parents.animalType.animalTypeId !== fields.animalTypeId) throw new FoundationError("INVALID_INPUT");
  if (!parents.animalType.active) throw new FoundationError("CONFLICT");
  if (normalizeBirdCount(fields.startingQuantity) === null || !isCalendarDate(fields.acquisitionDate) || !POULTRY_PURPOSES.includes(fields.purpose)) throw new FoundationError("INVALID_INPUT");
  if (!batchLabelKey(fields.batchLabel)) throw new FoundationError("INVALID_INPUT");
}
