import type { AreaUnit, FarmActivity, LandOwnership, PreferredLanguage } from "@/modules/farmer-registry/domain/rules";
// English display labels. Other interface languages need review by real speakers before release.
export const ownershipLabels: Record<LandOwnership, string> = { OWNED: "I own it", RENTED: "Rented or leased", FAMILY: "Family land", COMMUNAL: "Communal land", OTHER: "Other arrangement" };
export const activityLabels: Record<FarmActivity, string> = { CROPS: "Crops", POULTRY: "Poultry", OTHER_LIVESTOCK: "Other livestock", OTHER: "Other" };
export const areaUnitLabels: Record<AreaUnit, string> = { ACRE: "Acres", HECTARE: "Hectares", SQUARE_METRE: "Square metres" };
export const languageLabels: Record<PreferredLanguage, string> = { en: "English", lg: "Luganda", nyn: "Runyankore-Rukiga" };
