import type { EnterpriseType, ProductionStatus } from "@/modules/enterprises-seasons/domain/production";
import type { CurrentQuantitySource, PoultryPurpose } from "@/modules/enterprises-seasons/domain/poultry-batch";

export const enterpriseTypeLabels: Record<EnterpriseType, string> = {
  CROP: "Crops", POULTRY: "Poultry", DAIRY: "Dairy", LIVESTOCK: "Livestock", FISH: "Fish", OTHER: "Other",
};
export const poultryPurposeLabels: Record<PoultryPurpose, string> = {
  EGGS: "Eggs (layers)", MEAT: "Meat (broilers)", DUAL_PURPOSE: "Dual purpose", BREEDING: "Breeding",
};
/** How the shown current count was derived; Phase 5 flock movements add sources. */
export const currentQuantitySourceLabels: Record<CurrentQuantitySource, string> = {
  STARTING_COUNT: "This is the starting number. Purchases, deaths and sales cannot be recorded yet, so it does not change.",
};
const birds = new Intl.NumberFormat("en");
export function birdCount(count: number): string { return birds.format(count) + (count === 1 ? " bird" : " birds"); }
export const productionStatusLabels: Record<ProductionStatus, string> = { ACTIVE: "Active", CLOSED: "Closed" };
