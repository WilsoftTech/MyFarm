import "server-only";
import type { Enterprise, Season, Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { EnterpriseView, ProductionRepository, SeasonView } from "../contracts/production";
import { requireProductionWriteAccess as requireWriteAccess, productionAfter as after } from "./production-access";

type Reader = PrismaClient | Prisma.TransactionClient;
const enterpriseView = (row: Enterprise): EnterpriseView => ({
  enterpriseId: row.id, tenantId: row.tenantId, farmId: row.farmId, name: row.name, type: row.type,
  status: row.status, version: row.version, createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
const seasonView = (row: Season): SeasonView => ({
  seasonId: row.id, tenantId: row.tenantId, farmId: row.farmId, label: row.label,
  startDate: row.startDate.toISOString().slice(0, 10), endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
  status: row.status, version: row.version, createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
const enterprise = (db: Reader, scope: { tenantId: string; farmId: string }, id: string) => db.enterprise.findFirst({ where: { ...scope, id } });
const season = (db: Reader, scope: { tenantId: string; farmId: string }, id: string) => db.season.findFirst({ where: { ...scope, id } });

export function productionRepository(db: PrismaClient): ProductionRepository {
  return {
    async enterprise(scope, id) {
      const row = await enterprise(db, { tenantId: scope.tenantId, farmId: scope.farmId }, id);
      return row ? enterpriseView(row) : null;
    },
    async season(scope, id) {
      const row = await season(db, { tenantId: scope.tenantId, farmId: scope.farmId }, id);
      return row ? seasonView(row) : null;
    },
    async plot(scope, id) {
      const row = await db.plot.findFirst({ where: { id, tenantId: scope.tenantId, farmId: scope.farmId }, select: { id: true, tenantId: true, farmId: true } });
      return row ? { plotId: row.id, tenantId: row.tenantId, farmId: row.farmId } : null;
    },
    async enterprises(scope, { cursor, limit }) {
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      const anchor = cursor ? after(await enterprise(db, where, cursor)) : {};
      const rows = await db.enterprise.findMany({ where: { ...where, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(enterpriseView);
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].enterpriseId : null };
    },
    async seasons(scope, { cursor, limit }) {
      const where = { tenantId: scope.tenantId, farmId: scope.farmId };
      const anchor = cursor ? after(await season(db, where, cursor)) : {};
      const rows = await db.season.findMany({ where: { ...where, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(seasonView);
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].seasonId : null };
    },
    createEnterprise: (scope, command) => db.$transaction(async tx => {
      await requireWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ENTERPRISE_CREATED", targetId: id });
      await requireWriteAccess(tx, scope);
      const row = replay ? await enterprise(tx, { tenantId: scope.tenantId, farmId: scope.farmId }, replay) : await tx.enterprise.create({ data: {
        id, tenantId: scope.tenantId, farmId: scope.farmId, createdBy: scope.actorId, name: command.name, type: command.type,
      } });
      // Existing immutable creation fields bind the receipt to this payload without a new receipt store.
      if (!row || row.createdBy !== scope.actorId || row.name !== command.name || row.type !== command.type) throw new FoundationError("CONFLICT");
      return enterpriseView(row);
    }),
    createSeason: (scope, command) => db.$transaction(async tx => {
      await requireWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "SEASON_CREATED", targetId: id });
      await requireWriteAccess(tx, scope);
      const row = replay ? await season(tx, { tenantId: scope.tenantId, farmId: scope.farmId }, replay) : await tx.season.create({ data: {
        id, tenantId: scope.tenantId, farmId: scope.farmId, createdBy: scope.actorId, label: command.label,
        startDate: new Date(command.startDate + "T00:00:00.000Z"), endDate: command.endDate ? new Date(command.endDate + "T00:00:00.000Z") : null,
      } });
      if (!row || row.createdBy !== scope.actorId) throw new FoundationError("CONFLICT");
      const result = seasonView(row);
      if (result.label !== command.label || result.startDate !== command.startDate || result.endDate !== (command.endDate ?? null)) throw new FoundationError("CONFLICT");
      return result;
    }),
  };
}
