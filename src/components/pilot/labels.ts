import type { ObservationKind, ObservedScreen, ReviewDecision } from "@/modules/field-pilot/domain/evidence";
import type { PROMPT_CHANNELS, SUPPORT_CATEGORIES } from "@/modules/field-pilot/contracts/pilot";
import type { PilotValue, SupportSeverity } from "@/modules/field-pilot/domain/measures";

export const channelLabels: Record<typeof PROMPT_CHANNELS[number], string> = { CALL: "Phone call", SMS: "Text message", VISIT: "Visit", OTHER: "Other" };
export const categoryLabels: Record<typeof SUPPORT_CATEGORIES[number], string> = { SIGN_IN: "Signing in", SYNC: "Sending entries", DATA_ENTRY: "Entering records", UNDERSTANDING: "Understanding a screen", DEVICE: "Phone or battery", OTHER: "Other" };
export const severityLabels: Record<SupportSeverity, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High: stops the farmer" };
const reasons: Record<Extract<PilotValue, { status: "UNAVAILABLE" }>["reason"], string> = { NO_FARMERS: "Not available: no farmers yet", NO_PHONE_ENTRIES: "Not available: nothing sent from phones yet" };
/** A share or rate as the service gave it, or why it cannot be worked out; never a 0 standing in for "unknown". */
export function pilotValue(value: PilotValue, suffix = "%"): string {
  return value.status === "AVAILABLE" ? value.value + suffix : reasons[value.reason];
}

export const screenLabels: Record<ObservedScreen, string> = { EXPENSE_FORM: "Expense form", INCOME_FORM: "Income form", SALE_OR_PURCHASE_FORM: "Sale or purchase form", HARVEST_FORM: "Harvest form", ACTIVITY_FORM: "Activity form", STOCK: "Stock", OFFLINE_WORK: "Offline work", FARM_FIGURES: "How the farm is doing", SIGN_IN: "Signing in", OTHER: "Other" };
export const kindLabels: Record<ObservationKind, string> = { HESITATION: "Hesitated", CONFUSION: "Confused", ERROR: "Made a mistake", WORKAROUND: "Found a way around", WORDING: "Words not understood", POSITIVE: "Went well" };
export const decisionLabels: Record<ReviewDecision, string> = { CONTINUE: "Continue the pilot", GO: "Go: farmers are continuing on their own", NO_GO: "No go: farmers are not continuing on their own" };
