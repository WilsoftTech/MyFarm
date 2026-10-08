import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/modules/farmer-registry/domain/rules";
import { farmSchema, farmerProfileSchema, plotSchema, registerFarmerSchema } from "@/modules/farmer-registry/contracts/registry";

const profile = { name: "Amina N.", phone: "0772 123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["POULTRY"] };
const farm = { name: "Home farm", district: "Rukungiri", ownershipType: "FAMILY", primaryActivity: "CROPS" };
const issues = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) => result.error?.issues.map(i => i.path.join(".") + ": " + i.message) ?? [];

describe("phone normalization", () => {
it.each([["0772123456", "+256772123456"], ["0772 123 456", "+256772123456"], ["+256 772-123456", "+256772123456"], ["256772123456", "+256772123456"], ["+254712345678", "+254712345678"]])("%s -> %s", (raw, expected) => expect(normalizePhone(raw)).toBe(expected));
it.each(["", "12345", "0412345678", "+0772123456", "07721234567", "phone"])("rejects %s", raw => expect(normalizePhone(raw)).toBeNull());
});

describe("farmer profile minimization (AC002)", () => {
it("accepts the minimal profile and drops empty optional fields", () => {
const result = farmerProfileSchema.safeParse({ ...profile, alternativePhone: "", subcounty: " ", village: "" });
expect(result.success).toBe(true);
expect(result.data).toEqual({ name: "Amina N.", phone: "+256772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["POULTRY"], alternativePhone: undefined, subcounty: undefined, village: undefined });
});
it("rejects undeclared personal data instead of storing it", () => {
expect(farmerProfileSchema.safeParse({ ...profile, nationalId: "CM123" }).success).toBe(false);
expect(registerFarmerSchema.safeParse({ ...profile, requestId: crypto.randomUUID(), dateOfBirth: "1990-01-01" }).success).toBe(false);
});
it("rejects an alternative phone equal to the main phone after normalization", () => {
expect(issues(farmerProfileSchema.safeParse({ ...profile, alternativePhone: "+256772123456" }))).toEqual(["alternativePhone: Enter a different alternative phone number, or leave it empty."]);
});
it("requires at least one distinct main activity and a known language", () => {
expect(farmerProfileSchema.safeParse({ ...profile, mainActivities: [] }).success).toBe(false);
expect(farmerProfileSchema.safeParse({ ...profile, mainActivities: ["CROPS", "CROPS"] }).success).toBe(false);
expect(farmerProfileSchema.safeParse({ ...profile, preferredLanguage: "fr" }).success).toBe(false);
});
it("rejects invalid phone and missing district with plain messages", () => {
expect(issues(farmerProfileSchema.safeParse({ ...profile, phone: "123", district: "" }))).toEqual(["phone: Enter a phone number like 0772 123456 or +256772123456.", "district: Enter your district."]);
});
});

describe("farm acreage and GPS (AC003)", () => {
it("accepts a farm without GPS or acreage", () => {
expect(farmSchema.safeParse(farm)).toEqual({ success: true, data: farm });
expect(farmSchema.safeParse({ ...farm, latitude: "", longitude: "" }).success).toBe(true);
});
it("keeps decimals as exact strings", () => {
expect(farmSchema.safeParse({ ...farm, approximateAcreage: "2.5", latitude: "-0.790123", longitude: "29.926745" }).data).toMatchObject({ approximateAcreage: "2.5", latitude: "-0.790123", longitude: "29.926745" });
});
it.each(["-1", "-0.5", "abc", "1e3", "2.12345", "123456789"])("rejects acreage %s", acreage => expect(farmSchema.safeParse({ ...farm, approximateAcreage: acreage }).success).toBe(false));
it("accepts zero acreage", () => expect(farmSchema.safeParse({ ...farm, approximateAcreage: "0" }).success).toBe(true));
it("requires a complete coordinate pair", () => {
expect(issues(farmSchema.safeParse({ ...farm, latitude: "-0.79" }))).toEqual(["longitude: Enter both latitude and longitude, or leave both empty."]);
expect(farmSchema.safeParse({ ...farm, longitude: "29.9" }).success).toBe(false);
});
it.each([["90", "180", true], ["-90", "-180", true], ["90.000000", "0", true], ["90.000001", "0", false], ["0", "180.5", false], ["-91", "0", false], ["0", "1800", false], ["0.1234567", "0", false]])("lat %s lon %s valid=%s", (latitude, longitude, valid) => {
expect(farmSchema.safeParse({ ...farm, latitude, longitude }).success).toBe(valid);
});
});

describe("plot area", () => {
it("allows a plot without area, requires unit with area, rejects negative area", () => {
expect(plotSchema.safeParse({ name: "Plot A", area: "", areaUnit: "" }).success).toBe(true);
expect(plotSchema.safeParse({ name: "Plot A", area: "0.5", areaUnit: "ACRE" }).success).toBe(true);
expect(issues(plotSchema.safeParse({ name: "Plot A", area: "0.5" }))).toEqual(["areaUnit: Enter both the area and its unit, or leave both empty."]);
expect(plotSchema.safeParse({ name: "Plot A", areaUnit: "ACRE" }).success).toBe(false);
expect(plotSchema.safeParse({ name: "Plot A", area: "-1", areaUnit: "ACRE" }).success).toBe(false);
expect(plotSchema.safeParse({ name: "Plot A", farmId: crypto.randomUUID() }).success).toBe(false);
});
});
