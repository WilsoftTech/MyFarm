// Deterministic registry rules. No provider, UI or persistence imports.
export const LAND_OWNERSHIP = ["OWNED", "RENTED", "FAMILY", "COMMUNAL", "OTHER"] as const;
export const FARM_ACTIVITIES = ["CROPS", "POULTRY", "OTHER_LIVESTOCK", "OTHER"] as const;
export const AREA_UNITS = ["ACRE", "HECTARE", "SQUARE_METRE"] as const;
// Preference codes only; recording a language does not imply a translated interface.
export const PREFERRED_LANGUAGES = ["en", "lg", "nyn"] as const;
export type LandOwnership = typeof LAND_OWNERSHIP[number];
export type FarmActivity = typeof FARM_ACTIVITIES[number];
export type AreaUnit = typeof AREA_UNITS[number];
export type PreferredLanguage = typeof PREFERRED_LANGUAGES[number];

// Ugandan local/international mobile forms normalize to +256; other numbers must already be E.164.
export function normalizePhone(raw: string): string | null {
const compact = raw.replace(/[\s\-().]/g, "");
const uganda = /^(?:\+?256|0)(7\d{8})$/.exec(compact);
if (uganda) return "+256" + uganda[1];
return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}

// Decimal strings stay strings end to end; never parsed to floating point for storage.
export function isNonNegativeDecimal(value: string, integerDigits: number, fractionDigits: number): boolean {
return new RegExp("^\\d{1," + integerDigits + "}(?:\\.\\d{1," + fractionDigits + "})?$").test(value);
}

function withinBound(value: string, bound: number): boolean {
if (!/^-?\d{1,3}(?:\.\d{1,6})?$/.test(value)) return false;
const [whole, fraction = ""] = value.replace("-", "").split(".");
const integer = Number(whole);
return integer < bound || (integer === bound && /^0*$/.test(fraction));
}
export const isLatitude = (value: string) => withinBound(value, 90);
export const isLongitude = (value: string) => withinBound(value, 180);

export function isCompletePair(a: unknown, b: unknown): boolean {
return (a === undefined) === (b === undefined);
}
