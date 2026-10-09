import { z } from "zod";
import { AREA_UNITS, FARM_ACTIVITIES, LAND_OWNERSHIP, PREFERRED_LANGUAGES, isCompletePair, isLatitude, isLongitude, isNonNegativeDecimal, normalizePhone, type AreaUnit, type FarmActivity, type LandOwnership, type PreferredLanguage } from "../domain/rules";

const requiredText = (label: string, max: number) => z.string({ error: "Enter " + label + "." }).trim().min(1, "Enter " + label + ".").max(max, "Use " + max + " characters or fewer.");
const optionalText = (max: number) => z.string().trim().max(max, "Use " + max + " characters or fewer.").optional().transform(value => value || undefined);
const phone = (label: string) => z.string().trim().transform((value, context) => {
const normalized = normalizePhone(value);
if (!normalized) { context.addIssue({ code: "custom", message: "Enter " + label + " like 0772 123456 or +256772123456." }); return z.NEVER; }
return normalized;
});
const optionalPhone = (label: string) => z.string().trim().optional().transform((value, context) => {
if (!value) return undefined;
const normalized = normalizePhone(value);
if (!normalized) { context.addIssue({ code: "custom", message: "Enter " + label + " like 0772 123456 or +256772123456." }); return z.NEVER; }
return normalized;
});
const optionalDecimal = (message: string, valid: (value: string) => boolean) => z.string().trim().optional().transform((value, context) => {
if (!value) return undefined;
if (!valid(value)) { context.addIssue({ code: "custom", message }); return z.NEVER; }
return value;
});
const optionalChoice = <T extends readonly [string, ...string[]]>(values: T, message: string) => z.union([z.literal(""), z.enum(values, { error: message })]).optional().transform(value => value || undefined);
const command = { requestId: z.uuid("Refresh the page and try again.") };

const profileFields = {
name: requiredText("your name", 120),
phone: phone("a phone number"),
alternativePhone: optionalPhone("the alternative phone number"),
district: requiredText("your district", 80),
subcounty: optionalText(80),
village: optionalText(80),
preferredLanguage: z.enum(PREFERRED_LANGUAGES, { error: "Choose a preferred language." }),
ownershipType: z.enum(LAND_OWNERSHIP, { error: "Choose how you hold your farm land." }),
mainActivities: z.array(z.enum(FARM_ACTIVITIES), { error: "Choose at least one main activity." }).min(1, "Choose at least one main activity.").max(FARM_ACTIVITIES.length).refine(values => new Set(values).size === values.length, "Choose each activity once."),
};
const distinctPhones = (value: { phone: string; alternativePhone?: string }) => value.alternativePhone !== value.phone;
// Pair rules read only their own two fields, so they can run alongside other field errors and report all problems at once.
const always = () => true;
const distinctPhonesIssue = { message: "Enter a different alternative phone number, or leave it empty.", path: ["alternativePhone"], when: always };

// Strict objects reject undeclared personal data (for example identity numbers) instead of silently storing it.
export const farmerProfileSchema = z.object(profileFields).strict().refine(distinctPhones, distinctPhonesIssue);
export const registerFarmerSchema = z.object({ ...command, ...profileFields }).strict().refine(distinctPhones, distinctPhonesIssue);
export const updateProfileSchema = z.object({ ...command, expectedVersion: z.number().int().min(1), ...profileFields }).strict().refine(distinctPhones, distinctPhonesIssue);

const farmFields = {
name: requiredText("a farm name", 120),
district: requiredText("the farm district", 80),
subcounty: optionalText(80),
village: optionalText(80),
approximateAcreage: optionalDecimal("Enter acreage as a number of zero or more, like 2 or 2.5.", value => isNonNegativeDecimal(value, 8, 4)),
ownershipType: z.enum(LAND_OWNERSHIP, { error: "Choose how this farm land is held." }),
primaryActivity: z.enum(FARM_ACTIVITIES, { error: "Choose the main activity on this farm." }),
latitude: optionalDecimal("Enter a latitude between -90 and 90.", isLatitude),
longitude: optionalDecimal("Enter a longitude between -180 and 180.", isLongitude),
};
const completeCoordinates = (value: { latitude?: string; longitude?: string }) => isCompletePair(value.latitude, value.longitude);
const coordinatesIssue = { message: "Enter both latitude and longitude, or leave both empty.", path: ["longitude"], when: always };
export const farmSchema = z.object(farmFields).strict().refine(completeCoordinates, coordinatesIssue);
export const createFarmSchema = z.object({ ...command, ...farmFields }).strict().refine(completeCoordinates, coordinatesIssue);

const plotFields = {
name: requiredText("a plot name", 120),
area: optionalDecimal("Enter area as a number of zero or more, like 0.5.", value => isNonNegativeDecimal(value, 12, 6)),
areaUnit: optionalChoice(AREA_UNITS, "Choose an area unit."),
};
const completeArea = (value: { area?: string; areaUnit?: string }) => isCompletePair(value.area, value.areaUnit);
const areaIssue = { message: "Enter both the area and its unit, or leave both empty.", path: ["areaUnit"], when: always };
export const plotSchema = z.object(plotFields).strict().refine(completeArea, areaIssue);
export const createPlotSchema = z.object({ ...command, ...plotFields }).strict().refine(completeArea, areaIssue);

export const farmIdSchema = z.uuid();
export const farmPageSchema = z.object({ cursor: z.uuid().optional(), limit: z.number().int().min(1).max(50).default(20) }).strict();

export type FarmerProfileInput = z.input<typeof farmerProfileSchema>;
export type FarmerProfileData = z.output<typeof farmerProfileSchema>;
export type FarmInput = z.input<typeof farmSchema>;
export type FarmData = z.output<typeof farmSchema>;
export type PlotInput = z.input<typeof plotSchema>;
export type PlotData = z.output<typeof plotSchema>;

export interface FarmerView {
farmerId: string; tenantId: string; version: number;
name: string; phone: string; alternativePhone: string | null; district: string; subcounty: string | null; village: string | null;
preferredLanguage: PreferredLanguage; ownershipType: LandOwnership; mainActivities: FarmActivity[];
}
export interface FarmSummary { farmId: string; name: string; district: string; primaryActivity: FarmActivity; approximateAcreage: string | null; plotCount: number }
export interface PlotView { plotId: string; name: string; area: string | null; areaUnit: AreaUnit | null }
export interface FarmView {
farmId: string; tenantId: string; name: string; district: string; subcounty: string | null; village: string | null;
approximateAcreage: string | null; ownershipType: LandOwnership; primaryActivity: FarmActivity;
latitude: string | null; longitude: string | null; version: number; plots: PlotView[]; plotsTruncated: boolean;
}
export interface FarmPage { items: FarmSummary[]; nextCursor: string | null }

// All methods are scoped by server-derived user/tenant/farm identifiers; none accepts a client tenant claim.
export interface RegistryRepository {
farmerForUser(userId: string): Promise<FarmerView | null>;
registerFarmer(input: { userId: string; requestId: string; profile: FarmerProfileData }): Promise<FarmerView>;
/** True when this user's farmer registration was committed under this request ID (idempotent retry). */
registeredByRequest(input: { userId: string; tenantId: string; requestId: string }): Promise<boolean>;
updateProfile(input: { farmerId: string; tenantId: string; actorId: string; requestId: string; expectedVersion: number; profile: FarmerProfileData }): Promise<FarmerView>;
farmsForMember(input: { userId: string; tenantId: string; cursor?: string; limit: number }): Promise<FarmPage>;
farmForMember(input: { userId: string; farmId: string }): Promise<FarmView | null>;
createFarm(input: { tenantId: string; farmerId: string; actorId: string; requestId: string; farm: FarmData }): Promise<{ farmId: string }>;
createPlot(input: { tenantId: string; farmId: string; actorId: string; requestId: string; plot: PlotData }): Promise<{ plotId: string }>;
}
