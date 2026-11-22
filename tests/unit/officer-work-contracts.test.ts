import { describe, expect, it } from "vitest";
import { acceptRegistrationSchema, prepareRegistrationSchema, recordVisitSchema, finishWorkSchema, visitPhotoSchema, officerEnvelopeSchema } from "@/modules/extension-officers/contracts/work";
import { registrationConfirmation } from "@/modules/extension-officers/domain/registration";

const id = () => crypto.randomUUID();
const review = { profile: { name: "Farmer review", phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] }, farm: { name: "Reviewed farm", district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" } };
const visit = { requestId: id(), assignmentId: id(), scheduledOn: "2026-11-21", status: "COMPLETED", observations: "Farmer's recorded observations", recommendation: "Officer's recorded words" };

describe("P14 R002 registration and visit contracts", () => {
  it("validates an officer proposal with existing registry rules, without creating a record or assuming consent", () => {
    const parsed = prepareRegistrationSchema.parse({ requestId: id(), targetUserId: id(), review });
    expect(parsed.review.profile.phone).toBe("+256772123456");
    expect(parsed).not.toHaveProperty("confirmed");
    expect(parsed).not.toHaveProperty("farmerId");
  });
  it.each(["password", "authSubject", "tenantId", "role", "confirmed"])("rejects credentials, identity and authority field %s", key => {
    expect(prepareRegistrationSchema.safeParse({ requestId: id(), targetUserId: id(), review, [key]: "forged" }).success).toBe(false);
  });
  it("requires an explicit exact version and payload identity for the farmer's separate acceptance", () => {
    const base = { expectedVersion: 1, payloadHash: "a".repeat(64), confirmed: true };
    expect(acceptRegistrationSchema.parse(base)).toEqual(base);
    for (const change of [{ confirmed: false }, { confirmed: "yes" }, { expectedVersion: 0 }, { payloadHash: "changed" }, { actorId: id() }]) {
      expect(acceptRegistrationSchema.safeParse({ ...base, ...change }).success).toBe(false);
    }
  });
  it("accepts absent GPS and explicit follow-up/problem facts without generating a diagnosis", () => {
    expect(recordVisitSchema.parse(visit)).toEqual(visit);
    const recorded = recordVisitSchema.parse({ ...visit, followUp: { dueOn: "2026-11-23", notes: "Check again" }, problem: "Explicitly flagged issue" });
    expect(recorded.followUp?.dueOn).toBe("2026-11-23");
    expect(recorded.problem).toBe("Explicitly flagged issue");
    expect(recorded).not.toHaveProperty("diagnosis");
  });
  it.each([{ latitude: "-0.5" }, { longitude: "30.5" }, { latitude: "91", longitude: "30" }, { latitude: "0", longitude: "181" }, { scheduledOn: "2026-02-30" }, { status: "FINISHED" }, { problem: " " }, { observations: "x".repeat(2001) }, { officerId: id() }, { tenantId: id() }])("rejects invalid or forged visit detail %j", change => {
    expect(recordVisitSchema.safeParse({ ...visit, ...change }).success).toBe(false);
  });
  it("keeps coordinate decimals as strings and requires a version for consequential completion", () => {
    expect(recordVisitSchema.parse({ ...visit, latitude: "-0.123456", longitude: "30.987654" }).longitude).toBe("30.987654");
    expect(finishWorkSchema.safeParse({ requestId: id() }).success).toBe(false);
    expect(finishWorkSchema.safeParse({ requestId: id(), expectedVersion: 1 }).success).toBe(true);
  });
  it("bounds private photo metadata using the existing two-MiB limit, typed parent and digest", () => {
    const photo = { requestId: id(), visitId: id(), sha256: "a".repeat(64), contentType: "image/png", byteSize: 2 * 1024 * 1024 };
    expect(visitPhotoSchema.parse(photo)).toEqual(photo);
    for (const change of [{ byteSize: 0 }, { byteSize: photo.byteSize + 1 }, { contentType: "image/svg+xml" }, { sha256: "bad" }, { visitId: "foreign text" }, { objectKey: "other/farm" }]) {
      expect(visitPhotoSchema.safeParse({ ...photo, ...change }).success).toBe(false);
    }
  });
  it("requires stable offline provenance without allowing actor or sync-success claims", () => {
    const envelope = { schemaVersion: 1, clientMutationId: visit.requestId, deviceId: id(), createdAt: "2026-11-21T10:00:00Z", updatedAt: "2026-11-21T10:00:00Z", version: 1, syncStatus: "PENDING", organizationId: id(), operation: "OFFICER_RECORD_VISIT", farmId: id(), payload: visit };
    expect(officerEnvelopeSchema.parse(envelope)).toEqual(envelope);
    // A corrected phone clock must not reject a valid intent; server time orders effects.
    expect(officerEnvelopeSchema.safeParse({ ...envelope, updatedAt: "2026-11-20T10:00:00Z" }).success).toBe(true);
    for (const change of [{ clientMutationId: id() }, { actorId: id() }, { syncStatus: "SYNCED" }, { deviceId: "" }, { updatedAt: "not a date" }, { version: 0 }, { operation: "RECORD_EXPENSE" }]) {
      expect(officerEnvelopeSchema.safeParse({ ...envelope, ...change }).success).toBe(false);
    }
  });
});

describe("farmer-confirmed officer proposal, with trusted server facts", () => {
  const account = { id: id(), authSubject: id(), status: "ACTIVE" as const };
  const now = new Date("2026-11-21T10:00:00Z");
  const draft = { targetUserId: account.id, version: 1, payloadHash: "a".repeat(64), expiresAt: "2026-11-21T10:01:00Z", acceptedFarmId: null, discardedAt: null };
  const confirmation = { expectedVersion: 1, payloadHash: draft.payloadHash, confirmed: true };
  it("allows only the named farmer's exact current review", () => {
    expect(registrationConfirmation(account, draft, confirmation, now)).toBe("EXECUTE");
    expect(() => registrationConfirmation({ ...account, id: id() }, draft, confirmation, now)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => registrationConfirmation({ ...account, status: "SUSPENDED" }, draft, confirmation, now)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
  it.each([{ confirmed: false }, { confirmed: "yes" }, { expectedVersion: 0 }])("refuses missing or ambiguous consent %j", change => {
    expect(() => registrationConfirmation(account, draft, { ...confirmation, ...change }, now)).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });
  it.each([{ expectedVersion: 2 }, { payloadHash: "b".repeat(64) }])("invalidates confirmation after an edit %j", change => {
    expect(() => registrationConfirmation(account, draft, { ...confirmation, ...change }, now)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it("refuses exact expiry and discarded drafts without relying on client clocks", () => {
    expect(() => registrationConfirmation(account, draft, confirmation, new Date(draft.expiresAt))).toThrow(expect.objectContaining({ code: "CONFLICT" }));
    expect(() => registrationConfirmation(account, { ...draft, discardedAt: now.toISOString() }, confirmation, now)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
  it("recognizes the same completed review for access-checked receipt replay after expiry", () => {
    expect(registrationConfirmation(account, { ...draft, version: 2, acceptedFarmId: id() }, confirmation, new Date("2026-11-22T10:00:00Z"))).toBe("REPLAY");
    expect(() => registrationConfirmation(account, { ...draft, version: 3, acceptedFarmId: id() }, confirmation, now)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
});
