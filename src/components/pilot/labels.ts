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
