import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { productionAfter, requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ActivityRecord, ActivityRepository } from "../contracts/activity";
import { assertActivityOpen, assertLinkableCost, type ActivityBucket } from "../domain/activity";
import { ACTIVITY_LABELS, activityCapabilities, assertActivityAllowed } from "../domain/catalog";

export const farmWhere = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
export const calendarDate = (value: string) => new Date(value + "T00:00:00.000Z");
export const requestHash = (command: object) => createHash("sha256").update(JSON.stringify(command)).digest("hex");
export const activityInclude = { enterprise: { select: { name: true } }, plot: { select: { name: true } }, cost: { select: { id: true, kind: true, categoryName: true, amount: true, currency: true, occurredOn: true, status: true } } } as const;
type ActivityRow = Prisma.ProductionActivityGetPayload<{ include: typeof activityInclude }>;
const instant = (value: Date | null) => value?.toISOString() ?? null;
export const activityRecord = (r: ActivityRow): ActivityRecord => ({ activityId: r.id, tenantId: r.tenantId, farmId: r.farmId, type: r.type, typeLabel: ACTIVITY_LABELS[r.type],
  dueOn: r.dueOn.toISOString().slice(0, 10), status: r.status, enterpriseId: r.enterpriseId, enterpriseName: r.enterprise?.name ?? null, plotId: r.plotId, plotName: r.plot?.name ?? null,
  workerName: r.workerName, notes: r.notes, cost: r.cost ? { recordId: r.cost.id, kind: r.cost.kind === "PURCHASE" ? "PURCHASE" : "EXPENSE", categoryName: r.cost.categoryName, amount: r.cost.amount.toString(), currency: r.cost.currency, occurredOn: r.cost.occurredOn.toISOString().slice(0, 10), reversed: r.cost.status === "REVERSED" } : null, recurrenceId: r.recurrenceId,
  completedAt: instant(r.completedAt), completedBy: r.completedBy, cancelledAt: instant(r.cancelledAt), cancelledBy: r.cancelledBy, cancelReason: r.cancelReason,
  version: r.version, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });

/** Upcoming reads soonest first; the other buckets read most recent first. Keyset anchors must stay in the bucket. */
function bucketQuery(bucket: ActivityBucket, today: string): { where: Prisma.ProductionActivityWhereInput; direction: "asc" | "desc" } {
  const day = calendarDate(today);
  switch (bucket) {
    case "TODAY": return { where: { status: "SCHEDULED", dueOn: day }, direction: "asc" };
    case "UPCOMING": return { where: { status: "SCHEDULED", dueOn: { gt: day } }, direction: "asc" };
    case "MISSED": return { where: { status: "SCHEDULED", dueOn: { lt: day } }, direction: "desc" };
    case "COMPLETED": return { where: { status: "COMPLETED" }, direction: "desc" };
    case "CANCELLED": return { where: { status: "CANCELLED" }, direction: "desc" };
  }
}
export async function linkableCost(tx: Prisma.TransactionClient, scope: FarmScope, costRecordId: string | undefined) {
  if (!costRecordId) return;
  const record = await tx.accountingRecord.findFirst({ where: { ...farmWhere(scope), id: costRecordId }, select: { tenantId: true, farmId: true, kind: true, status: true } });
  if (!record) throw new FoundationError("FORBIDDEN");
  assertLinkableCost(scope, record);
}
export async function enterpriseForActivity(tx: Prisma.TransactionClient, scope: FarmScope, type: ActivityRecord["type"], enterpriseId: string | undefined, plotId: string | undefined) {
  const where = farmWhere(scope);
  const enterprise = enterpriseId ? await tx.enterprise.findFirst({ where: { ...where, id: enterpriseId } }) : null;
  const plot = plotId ? await tx.plot.findFirst({ where: { ...where, id: plotId } }) : null;
  if ((enterpriseId && !enterprise) || (plotId && !plot)) throw new FoundationError("FORBIDDEN");
  if (enterprise && enterprise.status !== "ACTIVE") throw new FoundationError("CONFLICT");
  assertActivityAllowed(type, enterprise?.type ?? null);
}

export function activityRepository(db: PrismaClient): ActivityRepository {
  /** Only a scheduled activity can finish, and only from the version the member was looking at. */
  const finish = (scope: Parameters<ActivityRepository["complete"]>[0], activityId: string, requestId: string, expectedVersion: number, action: string, finished: (row: ActivityRow) => boolean, data: Prisma.ProductionActivityUncheckedUpdateManyInput, costRecordId?: string) => db.$transaction(async tx => {
    await requireProductionWriteAccess(tx, scope);
    const where = { ...farmWhere(scope), id: activityId };
    const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId, action, targetId: activityId });
    await requireProductionWriteAccess(tx, scope);
    const current = await tx.productionActivity.findFirst({ where, include: activityInclude });
    if (!current) throw new FoundationError("FORBIDDEN");
    if (replay) {
      if (replay !== activityId || !finished(current) || current.version !== expectedVersion + 1) throw new FoundationError("CONFLICT");
      return activityRecord(current);
    }
    assertActivityOpen(current, expectedVersion);
    await linkableCost(tx, scope, costRecordId);
    const result = await tx.productionActivity.updateMany({ where: { ...where, status: "SCHEDULED", version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (result.count !== 1) throw new FoundationError("CONFLICT");
    return activityRecord(await tx.productionActivity.findFirstOrThrow({ where, include: activityInclude }));
  }, { isolationLevel: "ReadCommitted", timeout: 10_000 });
  return {
    async activity(scope, id) { const row = await db.productionActivity.findFirst({ where: { ...farmWhere(scope), id }, include: activityInclude }); return row ? activityRecord(row) : null; },
    async activities(scope, { cursor, limit, bucket, recurrenceId }, today) {
      const where = { ...farmWhere(scope), ...(recurrenceId ? { recurrenceId } : {}) };
      if (!bucket) {
        const anchor = cursor ? productionAfter(await db.productionActivity.findFirst({ where: { ...where, id: cursor } })) : {};
        const rows = await db.productionActivity.findMany({ where: { ...where, ...anchor }, include: activityInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
        return { items: rows.slice(0, limit).map(activityRecord), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
      }
      const query = bucketQuery(bucket, today), before = query.direction === "asc" ? "gt" : "lt";
      const anchor = cursor ? await db.productionActivity.findFirst({ where: { ...where, ...query.where, id: cursor }, select: { id: true, dueOn: true } }) : null;
      if (cursor && !anchor) throw new FoundationError("INVALID_INPUT");
      const after = anchor ? { OR: [{ dueOn: { [before]: anchor.dueOn } }, { dueOn: anchor.dueOn, id: { [before]: anchor.id } }] } : {};
      const rows = await db.productionActivity.findMany({ where: { ...where, AND: [query.where, after] }, include: activityInclude, orderBy: [{ dueOn: query.direction }, { id: query.direction }], take: limit + 1 });
      return { items: rows.slice(0, limit).map(activityRecord), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
    },
    async capabilities(scope, enterpriseId) {
      if (!enterpriseId) return activityCapabilities(null);
      const enterprise = await db.enterprise.findFirst({ where: { ...farmWhere(scope), id: enterpriseId } });
      return enterprise ? activityCapabilities(enterprise.type) : null;
    },
    schedule: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID(), where = farmWhere(scope), hash = requestHash(command);
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACTIVITY_SCHEDULED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const row = await tx.productionActivity.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, requestHash: hash }, include: activityInclude });
        if (!row) throw new FoundationError("CONFLICT");
        return activityRecord(row);
      }
      await enterpriseForActivity(tx, scope, command.type, command.enterpriseId, command.plotId);
      await linkableCost(tx, scope, command.costRecordId);
      const row = await tx.productionActivity.create({ data: { id, ...where, type: command.type, dueOn: calendarDate(command.dueOn), enterpriseId: command.enterpriseId, plotId: command.plotId,
        workerName: command.workerName, notes: command.notes, costRecordId: command.costRecordId, requestHash: hash, createdBy: scope.actorId }, include: activityInclude });
      return activityRecord(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
    // Worker, notes and cost keep their scheduled values unless completion supplies new ones.
    complete: (scope, activityId, command) => finish(scope, activityId, command.requestId, command.expectedVersion, "ACTIVITY_COMPLETED", row => row.status === "COMPLETED" && row.completedBy === scope.actorId,
      { status: "COMPLETED", completedAt: new Date(), completedBy: scope.actorId, workerName: command.workerName, notes: command.notes, costRecordId: command.costRecordId }, command.costRecordId),
    cancel: (scope, activityId, command) => finish(scope, activityId, command.requestId, command.expectedVersion, "ACTIVITY_CANCELLED", row => row.status === "CANCELLED" && row.cancelledBy === scope.actorId,
      { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: scope.actorId, cancelReason: command.reason }),
  };
}
