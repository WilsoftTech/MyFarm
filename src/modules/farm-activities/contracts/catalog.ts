import { z } from "zod";
import { ACTIVITY_TYPES } from "../domain/catalog";

export const activityTypeSchema = z.enum(ACTIVITY_TYPES, { error: "Choose an activity type." });
export type { ActivityCapability, ActivityType, ActivityUnavailableReason } from "../domain/catalog";
