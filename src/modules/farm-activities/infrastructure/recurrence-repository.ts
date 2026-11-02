import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { productionAfter, requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import type { RecurrenceRepository, RecurrenceView } from "../contracts/recurrence";
import { ACTIVITY_LABELS } from "../domain/catalog";
import { MAX_DATES_PER_EXPANSION, addDays, assertNotInPast, assertRecurringType, expansionPlan, RECURRENCE_HORIZON_DAYS } from "../domain/recurrence";
import { calendarDate, enterpriseForActivity, farmWhere, requestHash } from "./activity-repository";

const include = { enterprise: { select: { name: true, status: true } }, plot: { select: { name: true } } } as const;
type RecurrenceRow = Prisma.ActivityRecurrenceGetPayload<{ include: typeof include }>;
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;
const rule = (r: RecurrenceRow) => ({ frequency: r.frequency, interval: r.interval, startOn: r.startOn.toISOString().slice(0, 10), endOn: day(r.endOn), stoppedFrom: day(r.stoppedFrom) });
const view = (r: RecurrenceRow): RecurrenceView => ({ recurrenceId: r.id, tenantId: r.tenantId, farmId: r.farmId, type: r.type, typeLabel: ACTIVITY_LABELS[r.type], ...rule(r),
  enterpriseId: r.enterpriseId, enterpriseName: r.enterprise?.name ?? null, plotId: r.plotId, plotName: r.plot?.name ?? null, workerName: r.workerName, notes: r.notes, previousId: r.previousId,
  version: r.version, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });
const lockSeries = (tx: Prisma.TransactionClient, id: string) => tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:activity-series:" + id}, 0))::text`;
const txOptions = { isolationLevel: "ReadCommitted" as const, timeout: 20_000 };

/** The unique series/date key makes this safe to repeat and to race; existing rows, including skipped ones, are kept. */
async function expandSeries(tx: Prisma.TransactionClient, scope: ProductionWriteScope, series: RecurrenceRow, today: string) {
  const plan = expansionPlan(rule(series), day(series.expandedThrough), today);
  const result = plan.dates.length === 0 ? { count: 0 } : await tx.productionActivity.createMany({ skipDuplicates: true, data: plan.dates.map(dueOn => ({ id: crypto.randomUUID(), tenantId: scope.tenantId, farmId: scope.farmId, type: series.type, dueOn: calendarDate(dueOn),
    enterpriseId: series.enterpriseId, plotId: series.plotId, workerName: series.workerName, notes: series.notes, recurrenceId: series.id, requestHash: requestHash({ recurrenceId: series.id, dueOn }), createdBy: scope.actorId })) });
  // Progress, not a farmer's change: updatedAt stays put so a replayed command returns the same record.
  await tx.activityRecurrence.updateMany({ where: { id: series.id, stoppedFrom: null }, data: { expandedThrough: calendarDate(plan.expandedThrough), updatedAt: series.updatedAt } });
  return result.count;
}
/** Open occurrences from the date onward are cancelled with a reason; completed and earlier ones stay as they are. */
const cancelFrom = (tx: Prisma.TransactionClient, scope: ProductionWriteScope, id: string, from: string, reason: string) => tx.productionActivity.updateMany({ where: { ...farmWhere(scope), recurrenceId: id, status: "SCHEDULED", dueOn: { gte: calendarDate(from) } },
  data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: scope.actorId, cancelReason: reason, version: { increment: 1 } } });

export function recurrenceRepository(db: PrismaClient): RecurrenceRepository {
  return {
    async recurrence(scope, id) { const row = await db.activityRecurrence.findFirst({ where: { ...farmWhere(scope), id }, include }); return row ? view(row) : null; },
    async recurrences(scope, { cursor, limit }) {
      const where = farmWhere(scope);
      const anchor = cursor ? productionAfter(await db.activityRecurrence.findFirst({ where: { ...where, id: cursor } })) : {};
      const rows = await db.activityRecurrence.findMany({ where: { ...where, ...anchor }, include, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      return { items: rows.slice(0, limit).map(view), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
    },
    create: (scope, command, today) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID(), where = farmWhere(scope), hash = requestHash(command);
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACTIVITY_SERIES_CREATED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const row = await tx.activityRecurrence.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, requestHash: hash }, include });
        if (!row) throw new FoundationError("CONFLICT");
        return view(row);
      }
      assertRecurringType(command.type);
      assertNotInPast(command.startOn, today);
      await enterpriseForActivity(tx, scope, command.type, command.enterpriseId, command.plotId);
      const row = await tx.activityRecurrence.create({ data: { id, ...where, type: command.type, frequency: command.frequency, interval: command.interval, startOn: calendarDate(command.startOn), endOn: command.endOn ? calendarDate(command.endOn) : null,
        enterpriseId: command.enterpriseId, plotId: command.plotId, workerName: command.workerName, notes: command.notes, requestHash: hash, createdBy: scope.actorId }, include });
      await expandSeries(tx, scope, row, today);
      return view(row);
    }, txOptions),
    change: (scope, id, command, today) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const nextId = crypto.randomUUID(), where = farmWhere(scope), hash = requestHash(command);
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACTIVITY_SERIES_CHANGED", targetId: nextId });
      await lockSeries(tx, id);
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const row = await tx.activityRecurrence.findFirst({ where: { ...where, id: replay, previousId: id, createdBy: scope.actorId, requestHash: hash }, include });
        if (!row) throw new FoundationError("CONFLICT");
        return view(row);
      }
      const current = await tx.activityRecurrence.findFirst({ where: { ...where, id }, include });
      if (!current) throw new FoundationError("FORBIDDEN");
      if (current.stoppedFrom || current.version !== command.expectedVersion) throw new FoundationError("CONFLICT");
      assertNotInPast(command.effectiveFrom, today);
      await enterpriseForActivity(tx, scope, current.type, current.enterpriseId ?? undefined, current.plotId ?? undefined);
      const from = calendarDate(command.effectiveFrom);
      // A completed occurrence on or after the change date would clash with the new pattern, so the farmer picks a later date.
      if (await tx.productionActivity.count({ where: { ...where, recurrenceId: id, status: "COMPLETED", dueOn: { gte: from } } })) throw new FoundationError("CONFLICT");
      const skipped = await tx.productionActivity.findMany({ where: { ...where, recurrenceId: id, status: "CANCELLED", dueOn: { gte: from } }, select: { dueOn: true } });
      const closed = await tx.activityRecurrence.updateMany({ where: { ...where, id, stoppedFrom: null, version: command.expectedVersion }, data: { stoppedFrom: from, version: { increment: 1 } } });
      if (closed.count !== 1) throw new FoundationError("CONFLICT");
      await cancelFrom(tx, scope, id, command.effectiveFrom, "Series changed");
      const next = await tx.activityRecurrence.create({ data: { id: nextId, ...where, type: current.type, frequency: command.frequency, interval: command.interval, startOn: from, endOn: command.endOn ? calendarDate(command.endOn) : null,
        enterpriseId: current.enterpriseId, plotId: current.plotId, workerName: command.workerName, notes: command.notes, previousId: id, requestHash: hash, createdBy: scope.actorId }, include });
      await expandSeries(tx, scope, next, today);
      // Dates the farmer already skipped stay skipped under the new pattern.
      if (skipped.length) await tx.productionActivity.updateMany({ where: { ...where, recurrenceId: nextId, status: "SCHEDULED", dueOn: { in: skipped.map(row => row.dueOn) } }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: scope.actorId, cancelReason: "Skipped earlier", version: { increment: 1 } } });
      return view(next);
    }, txOptions),
    stop: (scope, id, command, today) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = { ...farmWhere(scope), id };
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACTIVITY_SERIES_STOPPED", targetId: id });
      await lockSeries(tx, id);
      await requireProductionWriteAccess(tx, scope);
      const current = await tx.activityRecurrence.findFirst({ where, include });
      if (!current) throw new FoundationError("FORBIDDEN");
      if (replay) {
        if (replay !== id || day(current.stoppedFrom) !== command.stopFrom || current.version !== command.expectedVersion + 1) throw new FoundationError("CONFLICT");
        return view(current);
      }
      if (current.stoppedFrom || current.version !== command.expectedVersion) throw new FoundationError("CONFLICT");
      assertNotInPast(command.stopFrom, today);
      const closed = await tx.activityRecurrence.updateMany({ where: { ...where, stoppedFrom: null, version: command.expectedVersion }, data: { stoppedFrom: calendarDate(command.stopFrom), version: { increment: 1 } } });
      if (closed.count !== 1) throw new FoundationError("CONFLICT");
      await cancelFrom(tx, scope, id, command.stopFrom, "Series stopped");
      return view(await tx.activityRecurrence.findFirstOrThrow({ where, include }));
    }, txOptions),
    expand: (scope, today) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const horizon = calendarDate(addDays(today, RECURRENCE_HORIZON_DAYS));
      const due = await tx.activityRecurrence.findMany({ where: { ...farmWhere(scope), stoppedFrom: null, OR: [{ expandedThrough: null }, { expandedThrough: { lt: horizon } }] }, select: { id: true }, orderBy: [{ expandedThrough: { sort: "asc", nulls: "first" } }, { id: "asc" }], take: 50 });
      let created = 0;
      for (const { id } of due) {
        if (created >= MAX_DATES_PER_EXPANSION) break;
        await lockSeries(tx, id);
        // Re-read after the lock: a stop or change may have committed while waiting.
        const series = await tx.activityRecurrence.findFirst({ where: { ...farmWhere(scope), id, stoppedFrom: null }, include });
        if (series && (!series.enterprise || series.enterprise.status === "ACTIVE")) created += await expandSeries(tx, scope, series, today);
      }
      return { created };
    }, txOptions),
  };
}
