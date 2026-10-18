import type { EnterpriseType, ProductionStatus } from "@/modules/enterprises-seasons/domain/production";

export const enterpriseTypeLabels: Record<EnterpriseType, string> = {
  CROP: "Crops", POULTRY: "Poultry", DAIRY: "Dairy", LIVESTOCK: "Livestock", FISH: "Fish", OTHER: "Other",
};
export const productionStatusLabels: Record<ProductionStatus, string> = { ACTIVE: "Active", CLOSED: "Closed" };
