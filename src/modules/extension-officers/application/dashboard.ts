import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { OfficerReadRepository } from "../contracts/service";
import { grantOfficerSchema, revokeOfficerSchema, type AssignmentView, type GrantOfficer, type RevokeOfficer } from "../contracts/assignments";

export interface OfficerAssignmentRepository {
  assignments(actorId: string, farmId: string, cursor: string | null): Promise<{ items: AssignmentView[]; truncated: boolean; nextCursor: string | null }>;
  grant(actorId: string, farmId: string, command: GrantOfficer): Promise<AssignmentView>;
  revoke(actorId: string, farmId: string, command: RevokeOfficer): Promise<AssignmentView>;
}
function parse<T>(schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } }, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new FoundationError("INVALID_INPUT");
  return result.data;
}

export class OfficerDashboardService {
  constructor(private readonly auth: RegistryAuthorization, private readonly repository: OfficerReadRepository) {}
  async read(organizationId: unknown, cursor: unknown = null) {
    const scope = await this.auth.scope(organizationId, ["AGENT"]);
    const parsed = cursor === null ? null : idSchema.safeParse(cursor);
    if (parsed && !parsed.success) throw new FoundationError("INVALID_INPUT");
    return this.repository.dashboard(scope.actorId, scope.organizationId, parsed?.data ?? null);
  }
}

export class OfficerAssignmentService {
  constructor(private readonly auth: RegistryAuthorization, private readonly repository: OfficerAssignmentRepository) {}
  async list(farmId: unknown, cursor: unknown = null) {
    const account = await this.auth.account();
    return this.repository.assignments(account.id, parse(idSchema, farmId), cursor === null ? null : parse(idSchema, cursor));
  }
  async grant(farmId: unknown, input: unknown) {
    const account = await this.auth.account();
    return this.repository.grant(account.id, parse(idSchema, farmId), parse(grantOfficerSchema, input));
  }
  async revoke(farmId: unknown, input: unknown) {
    const account = await this.auth.account();
    return this.repository.revoke(account.id, parse(idSchema, farmId), parse(revokeOfficerSchema, input));
  }
}
