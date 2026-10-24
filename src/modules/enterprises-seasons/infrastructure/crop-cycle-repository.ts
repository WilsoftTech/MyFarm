import "server-only";
import type { CropCycle, Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { CropCycleRepository, CropCycleView, StartCropCycle } from "../contracts/crop-cycle";
import type { FarmScope } from "../domain/production";
import { assertCropCycleStart } from "../domain/crop-cycle";
import { productionAfter, requireProductionWriteAccess } from "./production-access";

type Reader = PrismaClient | Prisma.TransactionClient;
const scoped = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const cycle = (db: Reader, scope: FarmScope, id: string) => db.cropCycle.findFirst({ where: { ...scoped(scope), id } });
const view = (row: CropCycle): CropCycleView => ({
  cycleId: row.id, tenantId: row.tenantId, farmId: row.farmId, enterpriseId: row.enterpriseId, seasonId: row.seasonId, plotId: row.plotId,
  cropId: row.cropId, cropName: row.cropName, variety: row.variety, areaPlanted: row.areaPlanted.toString(), areaUnit: row.areaUnit,
  plantingDate: row.plantingDate.toISOString().slice(0, 10), expectedHarvest: row.expectedHarvest?.toISOString().slice(0, 10) ?? null,
  areaExceptionReason: row.areaExceptionReason, status: row.status, version: row.version, createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
function assertReplay(row: CropCycle | null, command: StartCropCycle, actorId: string): CropCycleView {
  if (!row || row.createdBy !== actorId) throw new FoundationError("CONFLICT");
  const result = view(row);
  if (result.enterpriseId !== command.enterpriseId || result.seasonId !== command.seasonId || result.plotId !== command.plotId || result.cropId !== command.cropId ||
    result.variety !== (command.variety ?? null) || result.areaPlanted !== command.areaPlanted || result.areaUnit !== command.areaUnit ||
    result.plantingDate !== command.plantingDate || result.expectedHarvest !== (command.expectedHarvest ?? null) || result.areaExceptionReason !== (command.areaExceptionReason ?? null)) throw new FoundationError("CONFLICT");
  return result;
}

export function cropCycleRepository(db: PrismaClient): CropCycleRepository {
  return {
    async plots(scope, { cursor, limit }) {
      const where = scoped(scope);
      const anchor = cursor ? productionAfter(await db.plot.findFirst({ where: { ...where, id: cursor } })) : {};
      const rows = await db.plot.findMany({ where: { ...where, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(row => ({ ...where, plotId: row.id, name: row.name, area: row.area?.toString() ?? null, areaUnit: row.areaUnit }));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].plotId : null };
    },
    async plot(scope, plotId) {
      const row = await db.plot.findFirst({ where: { ...scoped(scope), id: plotId } });
      return row ? { ...scoped(scope), plotId: row.id, name: row.name, area: row.area?.toString() ?? null, areaUnit: row.areaUnit } : null;
    },
    async crops(_scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await db.cropCatalog.findFirst({ where: { id: cursor, active: true } })) : {};
      const rows = await db.cropCatalog.findMany({ where: { active: true, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(row => ({ cropId: row.id, name: row.name }));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].cropId : null };
    },
    async cropCycle(scope, id) { const row = await cycle(db, scope, id); return row ? view(row) : null; },
    async cropCycles(scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await cycle(db, scope, cursor)) : {};
      const rows = await db.cropCycle.findMany({ where: { ...scoped(scope), ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(view);
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].cycleId : null };
    },
    startCropCycle: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      // Claim before the plot lock: identical requests always take locks in the same order.
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "CROP_CYCLE_STARTED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) return assertReplay(await cycle(tx, scope, replay), command, scope.actorId);
      // Transaction-level, not session-level: safe with pooled connections and released on rollback.
      // Hash collisions merely serialize unrelated plots; they cannot permit over-allocation.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:crop-plot:" + command.plotId}, 0))::text`;
      await requireProductionWriteAccess(tx, scope);
      const where = scoped(scope);
      const enterprise = await tx.enterprise.findFirst({ where: { ...where, id: command.enterpriseId } });
      const season = await tx.season.findFirst({ where: { ...where, id: command.seasonId } });
      const plot = await tx.plot.findFirst({ where: { ...where, id: command.plotId } });
      if (!enterprise || !season || !plot) throw new FoundationError("FORBIDDEN");
      const crop = await tx.cropCatalog.findUnique({ where: { id: command.cropId } });
      if (!crop) throw new FoundationError("INVALID_INPUT");
      // Never paginate capacity inputs or restrict them to one season/enterprise.
      const allocations = await tx.cropCycle.findMany({ where: { ...where, plotId: plot.id, status: "ACTIVE" }, select: {
        id: true, tenantId: true, farmId: true, plotId: true, areaPlanted: true, areaUnit: true, status: true,
      } });
      assertCropCycleStart(scope, command, {
        enterprise: { ...where, enterpriseId: enterprise.id, type: enterprise.type, status: enterprise.status },
        season: { ...where, seasonId: season.id, status: season.status },
        plot: { ...where, plotId: plot.id, area: plot.area?.toString() ?? null, areaUnit: plot.areaUnit },
        crop: { cropId: crop.id, name: crop.name, active: crop.active },
      }, allocations.map(row => ({ ...row, cycleId: row.id, areaPlanted: row.areaPlanted.toString() })));
      await requireProductionWriteAccess(tx, scope);
      const row = await tx.cropCycle.create({ data: {
        id, ...where, enterpriseId: command.enterpriseId, seasonId: command.seasonId, plotId: command.plotId, cropId: crop.id, cropName: crop.name,
        variety: command.variety, areaPlanted: command.areaPlanted, areaUnit: command.areaUnit,
        plantingDate: new Date(command.plantingDate + "T00:00:00.000Z"), expectedHarvest: command.expectedHarvest ? new Date(command.expectedHarvest + "T00:00:00.000Z") : null,
        areaExceptionReason: command.areaExceptionReason, createdBy: scope.actorId,
      } });
      return view(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
