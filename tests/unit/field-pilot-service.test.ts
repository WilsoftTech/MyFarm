import { describe, expect, it, vi } from "vitest";
import { FieldPilotService, newCohortCode, type PilotAuthorization } from "@/modules/field-pilot/application/pilot";
import type { PilotRepository } from "@/modules/field-pilot/contracts/pilot";
import { PILOT_CONSENT_VERSION } from "@/modules/field-pilot/domain/consent";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";

const id = () => crypto.randomUUID();
const actorId = id(), orgId = id(), cohortId = id();
const now = new Date("2027-04-10T09:00:00.000Z");
const cohort = { cohortId, tenantId: orgId, name: "A", status: "ACTIVE" as const, consentVersion: PILOT_CONSENT_VERSION, startOn: "2027-03-01", endOn: "2027-06-20" };
function fixture() {
  const auth: PilotAuthorization = { account: vi.fn(async () => ({ id: actorId })), scope: vi.fn(async () => ({ actorId, organizationId: orgId })) };
  const repo = Object.fromEntries((["isActiveFarmer", "createCohort", "cohorts", "cohort", "cohortByCode", "join", "myParticipations", "withdraw", "facts", "participants", "incidents", "recordPrompt", "openIncident", "resolveIncident", "recordPaperConsent"] as const).map(name => [name, vi.fn()])) as unknown as { [K in keyof PilotRepository]: ReturnType<typeof vi.fn> } & PilotRepository;
  repo.isActiveFarmer.mockResolvedValue(true);
  repo.cohortByCode.mockResolvedValue(cohort);
  repo.cohort.mockResolvedValue({ cohortId, name: "A", code: "RUK2027A", startOn: "2027-03-01", endOn: "2027-06-20", status: "ACTIVE", joined: 0 });
  return { auth, repo, service: new FieldPilotService(auth, repo, () => now, () => "RUK2027A") };
}
const join = { requestId: id(), code: "RUK2027A", consentVersion: PILOT_CONSENT_VERSION, agreed: true };

describe("pilot service order of checks (P09-T002)", () => {
  it("checks the session before reading the input or the cohort", async () => {
    const { auth, repo, service } = fixture();
    vi.mocked(auth.account).mockRejectedValue(new FoundationError("UNAUTHENTICATED"));
    await expect(service.join({ nonsense: true })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(repo.cohortByCode).not.toHaveBeenCalled();
  });
  it("a closed, ended or unknown cohort looks the same as a wrong code, and joining starts on the cohort's first day at the earliest", async () => {
    for (const found of [null, { ...cohort, status: "CLOSED" as const }, { ...cohort, endOn: "2027-04-09" }]) {
      const { repo, service } = fixture();
      repo.cohortByCode.mockResolvedValue(found);
      await expect(service.join(join)).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(repo.join).not.toHaveBeenCalled();
    }
    const { repo, service } = fixture();
    repo.cohortByCode.mockResolvedValue({ ...cohort, startOn: "2027-05-01" });
    await service.join(join);
    expect(repo.join).toHaveBeenCalledWith(expect.objectContaining({ userId: actorId, enrolledOn: "2027-05-01" }));
  });
  it("someone who is not an active farmer cannot join", async () => {
    const { repo, service } = fixture();
    repo.isActiveFarmer.mockResolvedValue(false);
    await expect(service.join(join)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.join).not.toHaveBeenCalled();
  });
  it("staff calls need ADMIN of the organization before anything is read, and a cohort of another organization looks missing", async () => {
    const { auth, repo, service } = fixture();
    vi.mocked(auth.scope).mockRejectedValue(new FoundationError("FORBIDDEN"));
    await expect(service.cohortView(orgId, cohortId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repo.facts).not.toHaveBeenCalled();
    const other = fixture();
    other.repo.cohort.mockResolvedValue(null);
    await expect(other.service.cohortView(orgId, cohortId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(other.service.cohortView(orgId, "not-an-id")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(other.repo.facts).not.toHaveBeenCalled();
    expect(other.auth.scope).toHaveBeenCalledWith(orgId, ["ADMIN"]);
  });
  it("the server picks the code and the consent version, never the client", async () => {
    const { repo, service } = fixture();
    await service.createCohort(orgId, { requestId: id(), name: "Rukungiri A", startOn: "2027-03-01", endOn: "2027-06-20" });
    expect(repo.createCohort).toHaveBeenCalledWith({ actorId, organizationId: orgId }, expect.objectContaining({ code: "RUK2027A", consentVersion: PILOT_CONSENT_VERSION }));
    await expect(service.createCohort(orgId, { requestId: id(), name: "Rukungiri A", startOn: "2027-03-01", endOn: "2027-06-20", code: "MINE0000" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("cohort codes", () => {
  it("are 8 characters with no 0, O, 1 or I to misread", () => {
    for (let i = 0; i < 200; i++) expect(newCohortCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(newCohortCode(bytes => bytes.fill(0))).toBe("AAAAAAAA");
  });
});

describe("refused codes are limited per farmer (D-P09-014)", () => {
  const limited = (allowed = true) => {
    const base = fixture();
    const limits = { allowed: vi.fn(async () => allowed), note: vi.fn(async () => {}) };
    return { ...base, limits, service: new FieldPilotService(base.auth, base.repo, () => now, () => "RUK2027A", limits) };
  };
  it("counts each refused code under its own request ID, and only refusals", async () => {
    const { repo, limits, service } = limited();
    repo.cohortByCode.mockResolvedValue(null);
    await expect(service.join(join)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(limits.allowed).toHaveBeenCalledWith(actorId, "PILOT_JOIN_REFUSED");
    expect(limits.note).toHaveBeenCalledWith(actorId, "PILOT_JOIN_REFUSED", join.requestId);
    const ok = limited();
    await ok.service.join(join);
    expect(ok.limits.note).not.toHaveBeenCalled();
  });
  it("over the limit, even the right code is turned away before the cohort is looked up", async () => {
    const { repo, limits, service } = limited(false);
    await expect(service.join(join)).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(repo.cohortByCode).not.toHaveBeenCalled();
    expect(repo.join).not.toHaveBeenCalled();
    expect(limits.note).not.toHaveBeenCalled();
  });
  it("input that is not a join is refused as input and not counted", async () => {
    const { limits, service } = limited();
    await expect(service.join({ code: "RUK2027A" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(limits.allowed).not.toHaveBeenCalled();
    expect(limits.note).not.toHaveBeenCalled();
  });
});
