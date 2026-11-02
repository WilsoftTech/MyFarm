import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { authorizeProductionFarm, type ProductionFarmAccess } from "@/modules/enterprises-seasons/application/farm-access";
import type { RegistryAuthorization } from "@/modules/farmer-registry/application/registry";

/** Only for the caller's own farm's tenant: a key from another tenant is simply not visible here. */
export function receiptLookup(auth: RegistryAuthorization, farms: ProductionFarmAccess, db: Pick<PrismaClient, "auditEvent">) {
  return { async priorActions(farmId: string, requestId: string) {
    const { scope } = await authorizeProductionFarm(auth, farms, farmId);
    return (await db.auditEvent.findMany({ where: { tenantId: scope.tenantId, requestId }, select: { action: true } })).map(row => row.action);
  } };
}
