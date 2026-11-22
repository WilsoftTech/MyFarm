import type { Account, Scope } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { authorizeScope } from "@/modules/engineering-foundation/domain/policy";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import { assignmentFactSchema, assignmentFarmSchema, dashboardFactsSchema, officerPermissionSchema, type AssignmentFact, type OfficerDashboard, type OfficerPermission } from "../contracts/dashboard";

function key(value: { tenantId: string; farmId: string; farmerId: string }): string {
  return `${value.tenantId}/${value.farmId}/${value.farmerId}`;
}
function current(grant: AssignmentFact, actorId: string, permission: OfficerPermission, now: Date): boolean {
  return grant.officerId === actorId.toLowerCase() && grant.ownerActive
    && grant.grantedByOwnerId === grant.currentOwnerId && grant.revokedAt === null
    && Date.parse(grant.validFrom) <= now.getTime()
    && (grant.expiresAt === null || now.getTime() < Date.parse(grant.expiresAt))
    && grant.permissions.includes(permission);
}
function requireClock(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new FoundationError("INVALID_INPUT");
}
/** Role is necessary but never grants access alone. Called with current trusted server facts.
 * No finance, export, global search or assisted-registration action is accepted.
 */
export function assertOfficerAssignment(account: Account, scope: Scope | null, rawGrant: unknown, rawPermission: unknown, targetFarm: unknown, now: Date): void {
  const actor = authorizeScope(account, scope, ["AGENT"]);
  requireClock(now);
  const grant = assignmentFactSchema.safeParse(rawGrant);
  const permission = officerPermissionSchema.safeParse(rawPermission);
  const target = assignmentFarmSchema.safeParse(targetFarm);
  if (!grant.success || !permission.success || !target.success || key(grant.data) !== key(target.data)
    || !current(grant.data, actor.actorId, permission.data, now)) {
    throw new FoundationError("FORBIDDEN");
  }
}
function unique<T extends { id: string }>(rows: T[]): T[] {
  const records = new Map<string, T>();
  for (const row of rows) {
    const previous = records.get(row.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new FoundationError("CONFLICT");
    records.set(row.id, row);
  }
  return [...records.values()];
}

/** Pure projection only: T002 must authenticate and load current consent/ownership/assignment
 * and consistently scoped facts. Never authorize a route from caller-supplied dashboard data.
 */
export function officerDashboard(account: Account, scope: Scope | null, input: unknown, now: Date): OfficerDashboard {
  const actor = authorizeScope(account, scope, ["AGENT"]);
  requireClock(now);
  const parsed = dashboardFactsSchema.safeParse(input);
  if (!parsed.success) throw new FoundationError("INVALID_INPUT");
  const facts = parsed.data;
  const result = { asOf: now.toISOString(), today: farmToday(now) };
  if (facts.coverage === "PARTIAL") return { ...result, coverage: "PARTIAL", counts: null };
  const grants = unique(facts.assignments);
  // The same physical farm cannot have conflicting farmer ownership in one consistent read.
  const farmOwners = new Map<string, string>();
  for (const grant of grants) {
    const farmKey = `${grant.tenantId}/${grant.farmId}`;
    const previous = farmOwners.get(farmKey);
    if (previous && previous !== grant.farmerId) throw new FoundationError("CONFLICT");
    farmOwners.set(farmKey, grant.farmerId);
  }
  const allowed = (permission: OfficerPermission) => new Set(grants.filter(grant =>
    current(grant, actor.actorId, "DASHBOARD", now) && current(grant, actor.actorId, permission, now)).map(key));
  const dashboardFarms = allowed("DASHBOARD");
  const visitFarms = allowed("VISITS");
  const followUpFarms = allowed("FOLLOW_UPS");
  const owned = (row: { officerId: string }) => row.officerId === actor.actorId.toLowerCase();
  const visits = unique(facts.visits).filter(row => owned(row) && visitFarms.has(key(row)));
  const visitKeys = new Set(visits.map(row => `${key(row)}/${row.id}`));
  return { ...result, coverage: "COMPLETE", counts: {
    myFarmers: new Set(grants.filter(grant => dashboardFarms.has(key(grant))).map(grant => grant.farmerId)).size,
    visitsToday: visits.filter(row => row.scheduledOn === result.today && row.status !== "CANCELLED").length,
    followUps: unique(facts.followUps).filter(row => owned(row) && followUpFarms.has(key(row)) && row.status === "OPEN" && row.dueOn <= result.today).length,
    problems: unique(facts.problems).filter(row => owned(row) && visitFarms.has(key(row)) && visitKeys.has(`${key(row)}/${row.visitId}`) && row.explicitlyFlagged && !row.resolved).length,
  } };
}
