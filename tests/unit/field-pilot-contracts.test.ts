import { describe, expect, it } from "vitest";
import { createCohortSchema, joinCohortSchema, paperConsentSchema, promptSchema, supportIncidentSchema, withdrawSchema } from "@/modules/field-pilot/contracts/pilot";
import { PILOT_CONSENT_POINTS, PILOT_CONSENT_VERSION } from "@/modules/field-pilot/domain/consent";

const id = () => crypto.randomUUID();
const join = (overrides: Record<string, unknown> = {}) => joinCohortSchema.safeParse({ requestId: id(), code: "RUK2027A", consentVersion: PILOT_CONSENT_VERSION, agreed: true, ...overrides });

describe("joining (D-P09-006)", () => {
  it("forgives spaces, dashes and case in a code read out over the phone", () => {
    expect(join({ code: " ruk-2027 a " })).toMatchObject({ success: true, data: { code: "RUK2027A" } });
    expect(join({ code: "RUK" }).success).toBe(false);
  });
  it("needs the current consent words and a ticked box", () => {
    expect(join({ consentVersion: "pilot-consent-v0" }).success).toBe(false);
    expect(join({ agreed: false }).success).toBe(false);
    expect(join({ agreed: undefined }).success).toBe(false);
  });
  it("never accepts who the farmer is, their tenant or their pseudonym from the client", () => {
    for (const forged of [{ userId: id() }, { tenantId: id() }, { pseudonym: "P-01" }, { cohortId: id() }]) expect(join(forged).success).toBe(false);
    expect(withdrawSchema.safeParse({ requestId: id(), participationId: id(), expectedVersion: 1, confirmed: true, userId: id() }).success).toBe(false);
  });
  it("the consent text tells the farmer what is counted, what staff see, and how to leave", () => {
    const text = PILOT_CONSENT_POINTS.join(" ");
    for (const point of [/code name/, /do not see your name, phone number, money amounts or records/, /leave the pilot at any time/, /does not change or delete your farm records/]) expect(text).toMatch(point);
  });
});

describe("staff commands (D-P09-004, D-P09-007)", () => {
  it("a cohort runs for one season at most, ending on or after its start", () => {
    const cohort = (startOn: string, endOn: string) => createCohortSchema.safeParse({ requestId: id(), name: "Rukungiri A", startOn, endOn }).success;
    expect(cohort("2027-03-01", "2027-06-20")).toBe(true);
    expect(cohort("2027-03-01", "2027-02-28")).toBe(false);
    expect(cohort("2027-03-01", "2028-03-01")).toBe(false);
    expect(cohort("2027-02-30", "2027-06-20")).toBe(false);
  });
  it("prompts, incidents and paper consent carry no personal details and only known choices", () => {
    expect(promptSchema.safeParse({ requestId: id(), participationId: id(), promptedOn: "2027-03-10", channel: "WHATSAPP" }).success).toBe(false);
    expect(supportIncidentSchema.safeParse({ requestId: id(), participationId: "", openedOn: "2027-03-10", category: "SYNC", severity: "HIGH", summary: "Entries waited" })).toMatchObject({ success: true, data: { participationId: undefined } });
    expect(supportIncidentSchema.safeParse({ requestId: id(), openedOn: "2027-03-10", category: "SYNC", severity: "URGENT", summary: "x x x" }).success).toBe(false);
    expect(paperConsentSchema.safeParse({ requestId: id(), participationId: id(), paperConsentRef: "x".repeat(61), expectedVersion: 1 }).success).toBe(false);
  });
});
