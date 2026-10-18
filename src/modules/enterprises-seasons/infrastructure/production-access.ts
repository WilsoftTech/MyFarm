import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { ProductionWriteScope } from "../contracts/production";

/** Recheck in the write transaction, including after receipt/plot-lock waits. */
export async function requireProductionWriteAccess(tx: Prisma.TransactionClient, scope: ProductionWriteScope) {
  const actor = await tx.user.findFirst({ where: {
    id: scope.actorId, status: "ACTIVE",
    memberships: { some: { organizationId: scope.tenantId, role: "FARMER", status: "ACTIVE" } },
    farmMemberships: { some: { farmId: scope.farmId, tenantId: scope.tenantId, status: "ACTIVE" } },
  }, select: { id: true } });
  if (!actor) throw new FoundationError("FORBIDDEN");
}
export function productionAfter(anchor: { id: string; createdAt: Date } | null) {
  if (!anchor) throw new FoundationError("INVALID_INPUT");
  return { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] };
}
