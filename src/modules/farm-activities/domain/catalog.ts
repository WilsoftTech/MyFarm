import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { enterpriseWorkflow, type EnterpriseType, type ProductionWorkflow } from "@/modules/enterprises-seasons/domain/production";

/** Source P0398-P0408, plus cleaning from the recurring list at P0431. Every value is retained even without an MVP workflow. */
export const ACTIVITY_TYPES = Object.freeze(["PLANTING", "IRRIGATION", "WEEDING", "SPRAYING", "FERTILIZING", "VACCINATION", "FEEDING", "HARVESTING", "PRUNING", "MILKING", "CLEANING", "INSPECTION"] as const);
export type ActivityType = typeof ACTIVITY_TYPES[number];

export const ACTIVITY_LABELS: Readonly<Record<ActivityType, string>> = Object.freeze({
  PLANTING: "Planting", IRRIGATION: "Irrigation", WEEDING: "Weeding", SPRAYING: "Spraying", FERTILIZING: "Fertilizing", VACCINATION: "Vaccination",
  FEEDING: "Feeding", HARVESTING: "Harvesting", PRUNING: "Pruning", MILKING: "Milking", CLEANING: "Cleaning", INSPECTION: "Inspection",
});

/** MVP behavior follows the enterprise workflow registry, so it never branches on a crop or enterprise name. */
export const WORKFLOW_ACTIVITIES: Readonly<Record<ProductionWorkflow, readonly ActivityType[]>> = Object.freeze({
  CROP_CYCLE: Object.freeze(["PLANTING", "IRRIGATION", "WEEDING", "SPRAYING", "FERTILIZING", "HARVESTING", "PRUNING", "INSPECTION"] as const),
  POULTRY_BATCH: Object.freeze(["VACCINATION", "FEEDING", "CLEANING", "INSPECTION"] as const),
});

export type ActivityUnavailableReason = "NO_MVP_WORKFLOW" | "ENTERPRISE_NOT_SUPPORTED" | "NOT_FOR_THIS_ENTERPRISE";
export interface ActivityCapability { type: ActivityType; label: string; available: boolean; reason: ActivityUnavailableReason | null }

const mvpActivities = new Set<ActivityType>(Object.values(WORKFLOW_ACTIVITIES).flat());

/** Pass null for farm-level work with no enterprise. Unknown runtime values are unavailable rather than throwing. */
export function activityUnavailableReason(type: ActivityType, enterpriseType: EnterpriseType | null): ActivityUnavailableReason | null {
  if (!mvpActivities.has(type)) return "NO_MVP_WORKFLOW";
  if (enterpriseType === null) return null;
  const workflow = enterpriseWorkflow(enterpriseType);
  if (workflow === null) return "ENTERPRISE_NOT_SUPPORTED";
  return WORKFLOW_ACTIVITIES[workflow].includes(type) ? null : "NOT_FOR_THIS_ENTERPRISE";
}

export function activityCapabilities(enterpriseType: EnterpriseType | null): ActivityCapability[] {
  return ACTIVITY_TYPES.map(type => {
    const reason = activityUnavailableReason(type, enterpriseType);
    return { type, label: ACTIVITY_LABELS[type], available: reason === null, reason };
  });
}

export function assertActivityAllowed(type: ActivityType, enterpriseType: EnterpriseType | null): void {
  if (activityUnavailableReason(type, enterpriseType) !== null) throw new FoundationError("INVALID_INPUT");
}
