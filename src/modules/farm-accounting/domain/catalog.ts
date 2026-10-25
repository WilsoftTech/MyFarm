import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { applyCatalogRelease, type CatalogEntry } from "@/modules/enterprises-seasons/domain/catalog";
import { CATEGORY_KINDS, type CategoryKind } from "./accounting";

/**
 * Global reviewed reference data (D-P04-005): no tenant or farm owns a category or payment method, and
 * runtime roles never write them. Names are data, never code; they change only by data-release migration.
 */
export interface CategoryEntry extends CatalogEntry { kind: CategoryKind }
export interface CategoryRelease {
  additions: readonly { id: string; kind: CategoryKind; name: string }[];
  deactivations: readonly string[];
}

/**
 * Same rules as crop releases (D-P03-012), applied per kind: stable new IDs unique across ALL categories,
 * names unique per kind ignoring case/whitespace across active AND archived entries (so history snapshots
 * stay unambiguous), deactivation instead of deletion, no renames. A cost and a revenue category may share
 * a name because they are never offered for the same record kind. Returns the catalog after the release.
 */
export function applyCategoryRelease(current: readonly CategoryEntry[], release: CategoryRelease): CategoryEntry[] {
  const ids = new Set<string>();
  for (const entry of [...current, ...release.additions]) {
    if (!CATEGORY_KINDS.includes(entry.kind)) throw new FoundationError("INVALID_INPUT");
    if (ids.has(entry.id)) throw new FoundationError("CONFLICT");
    ids.add(entry.id);
  }
  const known = new Map(current.map(entry => [entry.id, entry.kind]));
  for (const id of release.deactivations) if (!known.has(id)) throw new FoundationError("INVALID_INPUT");
  return CATEGORY_KINDS.flatMap(kind => applyCatalogRelease(
    current.filter(entry => entry.kind === kind),
    { additions: release.additions.filter(entry => entry.kind === kind), deactivations: release.deactivations.filter(id => known.get(id) === kind) },
  ).map(entry => ({ ...entry, kind })));
}

/** Payment methods follow the plain catalog rule: names unique ignoring case/whitespace, never deleted. */
export function applyPaymentMethodRelease(current: readonly CatalogEntry[], release: { additions: readonly { id: string; name: string }[]; deactivations: readonly string[] }): CatalogEntry[] {
  return applyCatalogRelease(current, release);
}

export interface CategoryHistory { categoryId: string; name: string; archived: boolean }
/**
 * History always shows the name captured when the record was saved (AccountingRecord.categoryName), so
 * archiving a category never hides or rewrites past records. `current` is the catalog entry looked up by ID
 * (null if unavailable); it only adds whether the category is still offered for new records.
 */
export function categoryHistory(record: { categoryId: string; categoryName: string }, current: CategoryEntry | null): CategoryHistory {
  if (current && current.id !== record.categoryId) throw new FoundationError("INVALID_INPUT");
  return { categoryId: record.categoryId, name: record.categoryName, archived: !current?.active };
}
