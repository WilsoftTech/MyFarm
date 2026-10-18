import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

export const ENTERPRISE_TYPES = ["CROP", "POULTRY", "DAIRY", "LIVESTOCK", "FISH", "OTHER"] as const;
export type EnterpriseType = typeof ENTERPRISE_TYPES[number];
export const PRODUCTION_STATUSES = ["ACTIVE", "CLOSED"] as const;
export type ProductionStatus = typeof PRODUCTION_STATUSES[number];

/** These identifiers must come from current server authorization, not a command payload. */
export interface FarmScope { tenantId: string; farmId: string }
export interface EnterpriseReference extends FarmScope { enterpriseId: string; type: EnterpriseType; status: ProductionStatus }
export interface SeasonReference extends FarmScope { seasonId: string; status: ProductionStatus }
export interface PlotReference extends FarmScope { plotId: string }
export interface CropCycleLinks { enterpriseId: string; seasonId: string; plotId: string }
export interface PoultryBatchLinks { enterpriseId: string }

export const PRODUCTION_WORKFLOWS = ["CROP_CYCLE", "POULTRY_BATCH"] as const;
export type ProductionWorkflow = typeof PRODUCTION_WORKFLOWS[number];
/** The single enterprise-type → workflow map (D-P03-003). Other types are recorded without a production workflow. */
export const ENTERPRISE_WORKFLOWS: Readonly<Record<EnterpriseType, ProductionWorkflow | null>> = Object.freeze({
  CROP: "CROP_CYCLE", POULTRY: "POULTRY_BATCH", DAIRY: null, LIVESTOCK: null, FISH: null, OTHER: null,
});
/** Unknown runtime values (including prototype keys) have no workflow rather than throwing. */
export function enterpriseWorkflow(type: EnterpriseType): ProductionWorkflow | null {
  return Object.hasOwn(ENTERPRISE_WORKFLOWS, type) ? ENTERPRISE_WORKFLOWS[type] : null;
}
export function hasProductionWorkflow(type: EnterpriseType): boolean {
  return enterpriseWorkflow(type) !== null;
}
/** Display form for farmer/catalog text: NFC, trimmed, internal whitespace collapsed. */
export function displayText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ");
}
/** Identity key that ignores case and whitespace differences. */
export function textKey(value: string): string {
  return displayText(value).toLowerCase();
}

/** Calendar dates have no time zone. Reject impossible dates rather than normalizing them. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

/** Same-tenant farms are separate scopes too. This is a relationship check, not authentication. */
export function assertSameFarm(scope: FarmScope, parents: readonly FarmScope[]): void {
  if (parents.some(parent => parent.tenantId !== scope.tenantId || parent.farmId !== scope.farmId)) {
    throw new FoundationError("FORBIDDEN");
  }
}

/** Use only with parent records looked up under an authenticated, currently authorized farm. */
export function assertCropCycleParents(
  scope: FarmScope,
  links: CropCycleLinks,
  parents: { enterprise: EnterpriseReference; season: SeasonReference; plot: PlotReference },
): void {
  assertSameFarm(scope, [parents.enterprise, parents.season, parents.plot]);
  if (parents.enterprise.enterpriseId !== links.enterpriseId || parents.season.seasonId !== links.seasonId || parents.plot.plotId !== links.plotId) {
    throw new FoundationError("FORBIDDEN");
  }
  if (enterpriseWorkflow(parents.enterprise.type) !== "CROP_CYCLE") throw new FoundationError("INVALID_INPUT");
  if (parents.enterprise.status !== "ACTIVE" || parents.season.status !== "ACTIVE") throw new FoundationError("CONFLICT");
}

export function assertPoultryBatchParent(scope: FarmScope, links: PoultryBatchLinks, enterprise: EnterpriseReference): void {
  assertSameFarm(scope, [enterprise]);
  if (enterprise.enterpriseId !== links.enterpriseId) throw new FoundationError("FORBIDDEN");
  if (enterpriseWorkflow(enterprise.type) !== "POULTRY_BATCH") throw new FoundationError("INVALID_INPUT");
  if (enterprise.status !== "ACTIVE") throw new FoundationError("CONFLICT");
}
