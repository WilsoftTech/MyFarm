import type { ActivityUnavailableReason } from "@/modules/farm-activities/contracts/catalog";

export const activityUnavailableLabels: Record<ActivityUnavailableReason, string> = {
  NO_MVP_WORKFLOW: "not available yet",
  ENTERPRISE_NOT_SUPPORTED: "not available for this enterprise yet",
  NOT_FOR_THIS_ENTERPRISE: "not for this enterprise",
};
