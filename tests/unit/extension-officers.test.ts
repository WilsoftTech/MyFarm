import { describe, expect, it } from "vitest";
import type { Account, Scope } from "@/modules/engineering-foundation/contracts/identity";
import { assignmentFactSchema, dashboardFactsSchema, type AssignmentFact, type DashboardFacts } from "@/modules/extension-officers/contracts/dashboard";
import { assertOfficerAssignment, officerDashboard } from "@/modules/extension-officers/domain/dashboard";

const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
const account: Account = { id: id(1), authSubject: "verified-subject", status: "ACTIVE" };
const scope: Scope = { organizationId: id(2), name: "Officer organization", role: "AGENT", status: "ACTIVE" };
const now = new Date("2026-11-20T21:30:00Z"); // Nov 21 in the existing farm calendar.
const targetFarm = { tenantId: id(4), farmId: id(5), farmerId: id(6) };
function grant(overrides: Partial<AssignmentFact> = {}): AssignmentFact {
  return { id: id(3), tenantId: id(4), farmId: id(5), farmerId: id(6), officerId: account.id,
    grantedByOwnerId: id(6), currentOwnerId: id(6), ownerActive: true,
    validFrom: "2026-11-01T00:00:00Z", expiresAt: null, revokedAt: null,
    permissions: ["DASHBOARD", "VISITS", "FOLLOW_UPS"], ...overrides };
}
function fixture(): DashboardFacts {
  const farm = { tenantId: id(4), farmId: id(5), farmerId: id(6), officerId: account.id };
  return { coverage: "COMPLETE", assignments: [grant()],
    visits: [{ ...farm, id: id(10), scheduledOn: "2026-11-21", status: "PLANNED" }],
    followUps: [{ ...farm, id: id(11), dueOn: "2026-11-20", status: "OPEN" }],
    problems: [{ ...farm, id: id(12), visitId: id(10), explicitlyFlagged: true, resolved: false }] };
}
function counts(facts = fixture(), clock = now) { return officerDashboard(account, scope, facts, clock).counts; }

describe("Phase 14 approved assignment boundary", () => {
  it("requires a named owner grant even for an active officer", () => {
    expect(() => assertOfficerAssignment(account, scope, grant(), "DASHBOARD", targetFarm, now)).not.toThrow();
    expect(counts({ ...fixture(), assignments: [] })).toEqual({ myFarmers: 0, visitsToday: 0, followUps: 0, problems: 0 });
  });
  it.each(["FINANCE", "EXPORT", "SEARCH", "REGISTER_FARMER", "__proto__", null])("denies unsupported action %s", action => {
    expect(() => assertOfficerAssignment(account, scope, grant(), action, targetFarm, now)).toThrow("FORBIDDEN");
  });
  it.each<Partial<AssignmentFact>>([
    { officerId: id(99) }, { ownerActive: false }, { currentOwnerId: id(99) },
    { validFrom: "2026-11-20T21:30:01Z" }, { expiresAt: now.toISOString() },
    { expiresAt: "2026-11-19T00:00:00Z" }, { revokedAt: "2026-11-20T00:00:00Z" },
    { revokedAt: "2026-12-01T00:00:00Z" }, { permissions: ["VISITS"] },
  ])("denies stale/mismatched dashboard assignment %j", override => {
    expect(() => assertOfficerAssignment(account, scope, grant(override), "DASHBOARD", targetFarm, now)).toThrow("FORBIDDEN");
    expect(counts({ ...fixture(), assignments: [grant(override)] })).toEqual({ myFarmers: 0, visitsToday: 0, followUps: 0, problems: 0 });
  });
  it("accepts the start boundary and denies expiry boundary", () => {
    expect(() => assertOfficerAssignment(account, scope, grant({ validFrom: now.toISOString(), expiresAt: "2026-11-20T21:30:01Z" }), "VISITS", targetFarm, now)).not.toThrow();
  });
  it.each(["tenantId", "farmId", "farmerId"] as const)("cannot authorize another target %s from a valid grant", field => {
    expect(() => assertOfficerAssignment(account, scope, grant(), "VISITS", { ...targetFarm, [field]: id(99) }, now)).toThrow("FORBIDDEN");
  });
  it.each<Scope | null>([null, { ...scope, role: "ADMIN" }, { ...scope, role: "FARMER" }, { ...scope, status: "REVOKED" }])("requires current agent membership %j", invalidScope => {
    expect(() => officerDashboard(account, invalidScope, fixture(), now)).toThrow("FORBIDDEN");
  });
  it("denies suspended accounts", () => {
    expect(() => officerDashboard({ ...account, status: "SUSPENDED" }, scope, fixture(), now)).toThrow("FORBIDDEN");
  });
  it("removes previous officer counts after reassignment", () => {
    const facts = fixture();
    facts.assignments = [grant({ revokedAt: now.toISOString() }), grant({ id: id(90), officerId: id(91) })];
    expect(counts(facts)?.myFarmers).toBe(0);
  });
});

describe("Phase 14 deterministic dashboard", () => {
  it("counts current permitted facts at the farm calendar day, without source illustration totals", () => {
    expect(counts()).toEqual({ myFarmers: 1, visitsToday: 1, followUps: 1, problems: 1 });
    expect(officerDashboard(account, scope, fixture(), now).today).toBe("2026-11-21");
    expect(counts(fixture(), new Date("2026-11-20T20:59:59Z"))?.visitsToday).toBe(0);
  });
  it("counts distinct farmers across farms and multiple named grants", () => {
    const facts = fixture();
    facts.assignments.push(grant({ id: id(20), farmId: id(21) }), grant({ id: id(22) }), grant({ id: id(23), farmId: id(24), farmerId: id(25) }));
    expect(counts(facts)?.myFarmers).toBe(2);
  });
  it.each(["tenantId", "farmId", "farmerId", "officerId"] as const)("excludes foreign %s in every fact", field => {
    const facts = fixture();
    facts.visits[0][field] = id(99);
    facts.followUps[0][field] = id(99);
    facts.problems[0][field] = id(99);
    expect(counts(facts)).toEqual({ myFarmers: 1, visitsToday: 0, followUps: 0, problems: 0 });
  });
  it("applies separate capability permissions", () => {
    expect(counts({ ...fixture(), assignments: [grant({ permissions: ["DASHBOARD"] })] })).toEqual({ myFarmers: 1, visitsToday: 0, followUps: 0, problems: 0 });
  });
  it("counts completed visits today, excludes cancelled and other days", () => {
    const facts = fixture();
    const base = facts.visits[0];
    facts.visits.push({ ...base, id: id(20), status: "COMPLETED" }, { ...base, id: id(21), status: "CANCELLED" }, { ...base, id: id(22), scheduledOn: "2026-11-22" });
    expect(counts(facts)?.visitsToday).toBe(2);
  });
  it("counts open due-today and overdue followups only", () => {
    const facts = fixture();
    const base = facts.followUps[0];
    facts.followUps.push({ ...base, id: id(20), dueOn: "2026-11-21" }, { ...base, id: id(21), dueOn: "2026-11-22" }, { ...base, id: id(22), status: "COMPLETED" }, { ...base, id: id(23), status: "CANCELLED" });
    expect(counts(facts)?.followUps).toBe(2);
  });
  it("counts explicit unresolved issues only with a matching permitted parent visit", () => {
    const facts = fixture();
    const base = facts.problems[0];
    facts.problems.push({ ...base, id: id(20), resolved: true }, { ...base, id: id(21), explicitlyFlagged: false }, { ...base, id: id(22), visitId: id(99) });
    expect(counts(facts)?.problems).toBe(1);
  });
  it("deduplicates identical joined rows without duplicate totals", () => {
    const facts = fixture();
    facts.assignments.push({ ...facts.assignments[0] });
    facts.visits.push({ ...facts.visits[0] });
    facts.followUps.push({ ...facts.followUps[0] });
    facts.problems.push({ ...facts.problems[0] });
    expect(counts(facts)).toEqual({ myFarmers: 1, visitsToday: 1, followUps: 1, problems: 1 });
  });
  it.each(["assignments", "visits", "followUps", "problems"] as const)("rejects conflicting duplicate %s", collection => {
    const facts = fixture();
    // Same source identity with different scope indicates an inconsistent read.
    if (collection === "assignments") facts.assignments.push({ ...facts.assignments[0], farmId: id(99) });
    if (collection === "visits") facts.visits.push({ ...facts.visits[0], farmId: id(99) });
    if (collection === "followUps") facts.followUps.push({ ...facts.followUps[0], farmId: id(99) });
    if (collection === "problems") facts.problems.push({ ...facts.problems[0], farmId: id(99) });
    expect(() => counts(facts)).toThrow("CONFLICT");
  });
  it("rejects conflicting ownership for the same farm", () => {
    const facts = fixture();
    facts.assignments.push(grant({ id: id(20), farmerId: id(99) }));
    expect(() => counts(facts)).toThrow("CONFLICT");
  });
  it("returns unavailable totals for partial coverage, never a misleading zero", () => {
    expect(counts({ ...fixture(), coverage: "PARTIAL" })).toBeNull();
  });
});

describe("Phase 14 validated contract", () => {
  it("canonicalizes UUIDs before scope comparison", () => {
    const facts = fixture();
    facts.assignments[0].officerId = account.id.toUpperCase();
    expect(counts(facts)?.myFarmers).toBe(1);
  });
  it("rejects invalid dates, unexpected fields, invalid IDs and duplicate permissions", () => {
    expect(assignmentFactSchema.safeParse({ ...grant(), farmId: "guessed" }).success).toBe(false);
    expect(assignmentFactSchema.safeParse({ ...grant(), permissions: ["DASHBOARD", "DASHBOARD"] }).success).toBe(false);
    expect(assignmentFactSchema.safeParse({ ...grant(), expiresAt: "2026-10-01T00:00:00Z" }).success).toBe(false);
    expect(assignmentFactSchema.safeParse({ ...grant(), finance: true }).success).toBe(false);
    const facts = fixture();
    facts.visits[0].scheduledOn = "2026-02-29";
    expect(dashboardFactsSchema.safeParse(facts).success).toBe(false);
    expect(() => counts(facts)).toThrow("INVALID_INPUT");
  });
  it("requires explicit coverage and bounds the source fact arrays", () => {
    const facts = fixture();
    expect(dashboardFactsSchema.safeParse({ ...facts, coverage: undefined }).success).toBe(false);
    expect(dashboardFactsSchema.safeParse({ ...facts, visits: Array.from({ length: 10_001 }, () => facts.visits[0]) }).success).toBe(false);
  });
  it("rejects an invalid clock", () => {
    expect(() => counts(fixture(), new Date("invalid"))).toThrow("INVALID_INPUT");
  });
});
