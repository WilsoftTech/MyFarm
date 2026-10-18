import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { displayText, textKey } from "./production";

/** A global reference entry: crop (CropCatalog) or animal type (AnimalTypeCatalog). Names are data, never code. */
export interface CatalogEntry { id: string; name: string; active: boolean }
export interface CatalogRelease { additions: readonly { id: string; name: string }[]; deactivations: readonly string[] }

/**
 * Reviewed data releases (D-P03-012) are the only way catalogs change: no code change, no runtime writes.
 * Additions get new stable IDs and names that are unique ignoring case/whitespace across ALL entries,
 * including inactive ones, so historical snapshots never become ambiguous. Entries are deactivated, never
 * deleted or reused; renames are out of scope for a release. Returns the catalog after the release.
 */
export function applyCatalogRelease(current: readonly CatalogEntry[], release: CatalogRelease): CatalogEntry[] {
  const ids = new Set(current.map(entry => entry.id)), keys = new Set(current.map(entry => textKey(entry.name)));
  if (ids.size !== current.length || keys.size !== current.length) throw new FoundationError("CONFLICT");
  for (const { id, name } of release.additions) {
    if (name !== displayText(name) || name.length < 1 || name.length > 120) throw new FoundationError("INVALID_INPUT");
    if (ids.has(id) || keys.has(textKey(name))) throw new FoundationError("CONFLICT");
    ids.add(id); keys.add(textKey(name));
  }
  const active = new Set(current.filter(entry => entry.active).map(entry => entry.id)), deactivated = new Set<string>();
  for (const id of release.deactivations) {
    if (!active.has(id) || deactivated.has(id)) throw new FoundationError("INVALID_INPUT");
    deactivated.add(id);
  }
  return [
    ...current.map(entry => deactivated.has(entry.id) ? { ...entry, active: false } : entry),
    ...release.additions.map(({ id, name }) => ({ id, name, active: true })),
  ];
}
