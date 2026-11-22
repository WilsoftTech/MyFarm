import type { OfficerDashboard, OfficerPermission } from "./dashboard";

/** Only explicit current assignment access may produce this minimal farmer/farm list.
 * No phone, precise location, financial record, contact directory or export is projected.
 */
export interface AssignedFarm {
  assignmentId: string; farmId: string; tenantId: string; farmerId: string;
  name: string; district: string; version: number; permissions: OfficerPermission[];
}
export interface DashboardView {
  dashboard: OfficerDashboard; farms: AssignedFarm[]; nextCursor: string | null; officerAccountId: string;
}
export interface OfficerReadRepository {
  /** Recheck the active account, exact organization AGENT membership, grant and owner in
   * one consistent database transaction. Cursor anchors must belong to that permitted set.
   * Farm labels are paginated separately from the complete authoritative card counts.
   */
  dashboard(actorId: string, organizationId: string, cursor: string | null): Promise<DashboardView>;
}
