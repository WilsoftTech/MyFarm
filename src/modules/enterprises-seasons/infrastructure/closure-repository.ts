import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { ClosureRepository } from "../contracts/closure";
import { requireProductionWriteAccess } from "./production-access";
import { assertProductionClosure } from "../domain/closure";

export function closureRepository(db: PrismaClient): ClosureRepository {
  return { close: (scope, kind, recordId, input) => db.$transaction(async tx => {
    await requireProductionWriteAccess(tx, scope);
    const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: input.requestId, action: kind + "_CLOSED", targetId: recordId });
    await requireProductionWriteAccess(tx, scope);
    const where = { id: recordId, tenantId: scope.tenantId, farmId: scope.farmId };
    const initial = kind === "SEASON" ? await tx.season.findFirst({ where }) : await tx.cropCycle.findFirst({ where });
    if (!initial) throw new FoundationError("FORBIDDEN");
    const seasonId = "seasonId" in initial ? initial.seasonId : initial.id;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:production-season:" + seasonId}, 0))::text`;
    if ("plotId" in initial) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:crop-plot:" + initial.plotId}, 0))::text`;
    await requireProductionWriteAccess(tx, scope);
    const current = kind === "SEASON" ? await tx.season.findFirst({ where }) : await tx.cropCycle.findFirst({ where });
    if (!current) throw new FoundationError("FORBIDDEN");
    if (replay) {
      if (replay !== recordId || current.status !== "CLOSED" || current.version !== input.expectedVersion + 1) throw new FoundationError("CONFLICT");
      return { recordId, status: "CLOSED", version: current.version };
    }
    const activeCycles = kind === "SEASON" ? await tx.cropCycle.count({ where: { tenantId: scope.tenantId, farmId: scope.farmId, seasonId, status: "ACTIVE" } }) : 0;
    assertProductionClosure(current, input.expectedVersion, activeCycles);
    const update = { where: { ...where, status: "ACTIVE" as const, version: input.expectedVersion }, data: { status: "CLOSED" as const, version: { increment: 1 } } };
    const result = kind === "SEASON" ? await tx.season.updateMany(update) : await tx.cropCycle.updateMany(update);
    if (result.count !== 1) throw new FoundationError("CONFLICT");
    return { recordId, status: "CLOSED", version: input.expectedVersion + 1 };
  }, { isolationLevel: "ReadCommitted", timeout: 10_000 }) };
}
