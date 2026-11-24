import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { cooperativeIdSchema as idSchema, createCooperativeSchema, operationCommandSchema, relationshipCommandSchema, sectionSchema, type CooperativeRepository } from "../contracts/cooperative";
function parse<T>(schema: { parse(input: unknown): T }, input: unknown): T {
  try { return schema.parse(input); } catch { throw new FoundationError("INVALID_INPUT"); }
}
export class CooperativeService {
  constructor(private readonly auth: RegistryAuthorization, private readonly repository: CooperativeRepository) {}
  async list() { const account = await this.auth.account(); return this.repository.list(account.id); }
  async create(input: unknown) { const account = await this.auth.account(); return this.repository.create(account.id, parse(createCooperativeSchema, input)); }
  async relationship(organizationId: unknown, input: unknown) {
    const account = await this.auth.account();
    return this.repository.relationship(account.id, parse(idSchema, organizationId), parse(relationshipCommandSchema, input));
  }
  async operation(organizationId: unknown, input: unknown) {
    const account = await this.auth.account();
    return this.repository.operation(account.id, parse(idSchema, organizationId), parse(operationCommandSchema, input));
  }
  async read(organizationId: unknown, section: unknown = "members", cursor: unknown = null) {
    const account = await this.auth.account();
    return this.repository.read(account.id, parse(idSchema, organizationId), parse(sectionSchema, section), cursor === null ? null : parse(idSchema, cursor));
  }
}
