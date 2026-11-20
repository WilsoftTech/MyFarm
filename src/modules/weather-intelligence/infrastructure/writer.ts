import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import type { WeatherConfirmation, WeatherReceipt, WeatherWriter } from "../contracts/service";

// The existing immutable audit row records both dates and a payload digest. No raw stage/forecast is retained.
const actionFor = (c: WeatherConfirmation) => `WEATHER_MOVE:${c.oldDueOn}:${c.newDueOn}:${createHash("sha256").update(JSON.stringify(c)).digest("hex").slice(0, 40)}`;
const receipt = (c: WeatherConfirmation, receiptId: string): WeatherReceipt => {
  if (!c.input.activityId) throw new FoundationError("INVALID_INPUT");
  return { activityId: c.input.activityId, oldDueOn: c.oldDueOn, newDueOn: c.newDueOn, version: c.expectedVersion + 1, receiptId };
};
async function accessAndLock(tx: Prisma.TransactionClient, scope: ProductionWriteScope, c: WeatherConfirmation) {
  await requireProductionWriteAccess(tx, scope);
  if (!c.input.activityId) throw new FoundationError("INVALID_INPUT");
  const key = `weather:${scope.actorId}:${c.requestId}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))::text`;
  await requireProductionWriteAccess(tx, scope);
  const prior = await tx.auditEvent.findFirst({ where: { actorId: scope.actorId, requestId: c.requestId, action: { startsWith: "WEATHER_MOVE:" } } });
  if (prior && (prior.tenantId !== scope.tenantId || prior.action !== actionFor(c) || prior.targetId !== c.input.activityId)) throw new FoundationError("CONFLICT");
  const row = await tx.productionActivity.findFirst({ where: { id: c.input.activityId ?? "00000000-0000-0000-0000-000000000000", farmId: scope.farmId, tenantId: scope.tenantId } });
  if (!row) throw new FoundationError("FORBIDDEN");
  return prior ? receipt(c, prior.id) : null;
}
export function weatherWriter(db: PrismaClient): WeatherWriter {
  return {
    replay: (scope, c) => db.$transaction(tx => accessAndLock(tx, scope, c), { timeout: 10_000 }),
    move: (scope, c, district) => db.$transaction(async tx => {
      const prior = await accessAndLock(tx, scope, c); if (prior) return prior;
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "ProductionActivity" WHERE id=${c.input.activityId}::uuid AND "farmId"=${scope.farmId}::uuid AND "tenantId"=${scope.tenantId}::uuid FOR UPDATE`;
      await requireProductionWriteAccess(tx, scope);
      if (!rows.length) throw new FoundationError("FORBIDDEN");
      const row = await tx.productionActivity.findUniqueOrThrow({ where: { id: rows[0].id } });
      const farm = await tx.farm.findFirst({ where: { id: scope.farmId, tenantId: scope.tenantId }, select: { district: true } });
      const crop = c.input.cycleId ? await tx.cropCycle.findFirst({ where: { id: c.input.cycleId, farmId: scope.farmId, tenantId: scope.tenantId, status: "ACTIVE" } }) : null;
      if (c.input.cycleId && (!crop || (row.enterpriseId && row.enterpriseId !== crop.enterpriseId) || (row.plotId && row.plotId !== crop.plotId))) throw new FoundationError("CONFLICT");
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      if (row.status !== "SCHEDULED" || row.type !== "SPRAYING" || row.recurrenceId || row.version !== c.expectedVersion || row.dueOn.toISOString().slice(0,10) !== c.oldDueOn || farm?.district !== district || clock.now.getTime() >= Date.parse(c.expiresAt) || c.newDueOn < farmToday(clock.now)) throw new FoundationError("CONFLICT");
      const audit = await tx.auditEvent.create({ data: { actorId: scope.actorId, tenantId: scope.tenantId, requestId: c.requestId, targetId: row.id, action: actionFor(c) } });
      // Database-clock expiry is checked again in the actual conditional write.
      const count = await tx.$executeRaw`UPDATE "ProductionActivity" SET "dueOn"=${new Date(c.newDueOn+"T00:00:00Z")}::date, version=version+1, "updatedAt"=clock_timestamp() WHERE id=${row.id}::uuid AND version=${c.expectedVersion} AND status='SCHEDULED' AND clock_timestamp()<${new Date(c.expiresAt)}::timestamptz`;
      if (count !== 1) throw new FoundationError("CONFLICT");
      return receipt(c, audit.id);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
