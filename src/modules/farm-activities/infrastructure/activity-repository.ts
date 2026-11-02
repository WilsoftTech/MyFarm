import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { productionAfter, requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { ActivityRepository, ActivityView, ScheduleActivity } from "../contracts/activity";
import { ACTIVITY_LABELS, activityCapabilities, assertActivityAllowed } from "../domain/catalog";

const farmWhere = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const names = { enterprise: { select: { name: true } }, plot: { select: { name: true } } } as const;
type ActivityRow = Prisma.ProductionActivityGetPayload<{ include: typeof names }>;
const requestHash = (command: ScheduleActivity) => createHash("sha256").update(JSON.stringify(command)).digest("hex");
const view = (r: ActivityRow): ActivityView => ({ activityId: r.id, tenantId: r.tenantId, farmId: r.farmId, type: r.type, typeLabel: ACTIVITY_LABELS[r.type],
  dueOn: r.dueOn.toISOString().slice(0, 10), status: r.status, enterpriseId: r.enterpriseId, enterpriseName: r.enterprise?.name ?? null, plotId: r.plotId, plotName: r.plot?.name ?? null,
  version: r.version, createdBy: r.createdBy, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });

export function activityRepository(db: PrismaClient): ActivityRepository {
  return {
    async activity(scope, id) { const row = await db.productionActivity.findFirst({ where: { ...farmWhere(scope), id }, include: names }); return row ? view(row) : null; },
    async activities(scope, { cursor, limit }) {
      const where = farmWhere(scope);
      const anchor = cursor ? productionAfter(await db.productionActivity.findFirst({ where: { ...where, id: cursor } })) : {};
      const rows = await db.productionActivity.findMany({ where: { ...where, ...anchor }, include: names, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      return { items: rows.slice(0, limit).map(view), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
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
        const row = await tx.productionActivity.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, requestHash: hash }, include: names });
        if (!row) throw new FoundationError("CONFLICT");
        return view(row);
      }
      const enterprise = command.enterpriseId ? await tx.enterprise.findFirst({ where: { ...where, id: command.enterpriseId } }) : null;
      const plot = command.plotId ? await tx.plot.findFirst({ where: { ...where, id: command.plotId } }) : null;
      if ((command.enterpriseId && !enterprise) || (command.plotId && !plot)) throw new FoundationError("FORBIDDEN");
      if (enterprise && enterprise.status !== "ACTIVE") throw new FoundationError("CONFLICT");
      assertActivityAllowed(command.type, enterprise?.type ?? null);
      const row = await tx.productionActivity.create({ data: { id, ...where, type: command.type, dueOn: new Date(command.dueOn + "T00:00:00.000Z"), enterpriseId: enterprise?.id, plotId: plot?.id, requestHash: hash, createdBy: scope.actorId }, include: names });
      return view(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
