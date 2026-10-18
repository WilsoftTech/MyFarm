import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";
import type { FarmScope } from "../domain/production";

export interface ProductionFarmAccess {
  farmScopeForMember(input: { userId: string; farmId: string }): Promise<(FarmScope & { name: string }) | null>;
}
export function parseProductionInput<T>(schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } }, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new FoundationError("INVALID_INPUT");
  return result.data;
}
export async function authorizeProductionFarm(authorization: RegistryAuthorization, farms: ProductionFarmAccess, farmId: unknown) {
  const account = await authorization.account();
  const id = parseProductionInput(idSchema, farmId);
  const farm = await farms.farmScopeForMember({ userId: account.id, farmId: id });
  if (!farm) throw new FoundationError("FORBIDDEN");
  const scope = await authorization.scope(farm.tenantId, ["FARMER"]);
  if (scope.actorId !== account.id) throw new FoundationError("FORBIDDEN");
  return { scope: { tenantId: farm.tenantId, farmId: farm.farmId, actorId: scope.actorId }, farm: { farmId: farm.farmId, name: farm.name } };
}
