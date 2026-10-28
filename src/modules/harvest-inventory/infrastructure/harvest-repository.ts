import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type Harvest, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { productionAfter, requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { textKey, type FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { HarvestRepository, HarvestView } from "../contracts/harvest";
import { assertHarvest, quantityString, quantityUnits } from "../domain/harvest";

export const commandHash = (value: object) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const stockScope = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
export const stockDate = (value: string) => new Date(value + "T00:00:00.000Z");
const view = (r: Harvest): HarvestView => ({ harvestId: r.id, itemId: r.itemId, tenantId: r.tenantId, farmId: r.farmId,
  cropCycleId: r.cropCycleId, cropId: r.cropId, plotId: r.plotId, storageLocationId: r.storageLocationId,
  cropName: r.cropName, storageLocationName: r.storageLocationName, grade: r.grade, version: r.version, createdBy: r.createdBy,
  quantity: r.quantity.toString(), lossQuantity: r.lossQuantity.toString(),
  unit: "KG", harvestDate: r.harvestDate.toISOString().slice(0, 10), storedQuantity: quantityString(quantityUnits(r.quantity.toString()) - quantityUnits(r.lossQuantity.toString())),
  createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() });

export function harvestRepository(db: PrismaClient): HarvestRepository {
  return {
    async locations(scope, { cursor, limit }) {
      const where = stockScope(scope);
      const anchor = cursor ? productionAfter(await db.storageLocation.findFirst({ where: { ...where, id: cursor } })) : {};
      const rows = await db.storageLocation.findMany({ where: { ...where, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      return { items: rows.slice(0, limit).map(r => ({ storageLocationId: r.id, name: r.name })), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
    },
    createLocation: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID(), where = stockScope(scope);
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "STORAGE_LOCATION_CREATED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const row = await tx.storageLocation.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, name: command.name } });
        if (!row) throw new FoundationError("CONFLICT");
        return { storageLocationId: row.id, name: row.name };
      }
      try {
        const row = await tx.storageLocation.create({ data: { id, ...where, name: command.name, nameKey: textKey(command.name), createdBy: scope.actorId } });
        return { storageLocationId: row.id, name: row.name };
      } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new FoundationError("CONFLICT"); throw e; }
    }),
    async harvest(scope, id) { const row = await db.harvest.findFirst({ where: { ...stockScope(scope), id } }); return row ? view(row) : null; },
    async harvests(scope, { cursor, limit }) {
      const where = stockScope(scope);
      const anchor = cursor ? productionAfter(await db.harvest.findFirst({ where: { ...where, id: cursor } })) : {};
      const rows = await db.harvest.findMany({ where: { ...where, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      return { items: rows.slice(0, limit).map(view), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
    },
    recordHarvest: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID(), where = stockScope(scope), requestHash = commandHash(command);
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "HARVEST_RECORDED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const row = await tx.harvest.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, requestHash } });
        if (!row) throw new FoundationError("CONFLICT");
        return view(row);
      }
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:harvest-cycle:" + command.cropCycleId}, 0))::text`;
      await requireProductionWriteAccess(tx, scope);
      const cycle = await tx.cropCycle.findFirst({ where: { ...where, id: command.cropCycleId } });
      const plot = await tx.plot.findFirst({ where: { ...where, id: command.plotId } });
      const storage = await tx.storageLocation.findFirst({ where: { ...where, id: command.storageLocationId } });
      if (!cycle || !plot || !storage) throw new FoundationError("FORBIDDEN");
      assertHarvest(scope, command, { cycle: { ...cycle, cropCycleId: cycle.id, plantingDate: cycle.plantingDate.toISOString().slice(0, 10) }, plot: { ...plot, plotId: plot.id }, storage: { ...storage, storageLocationId: storage.id } });
      let item = await tx.inventoryItem.findFirst({ where: { ...where, cropCycleId: cycle.id } });
      if (!item) item = await tx.inventoryItem.create({ data: { ...where, cropCycleId: cycle.id, name: cycle.cropName, kind: "CROP", unit: "KG", createdBy: scope.actorId } });
      const row = await tx.harvest.create({ data: { id, ...where, cropCycleId: cycle.id, cropId: cycle.cropId, plotId: plot.id, storageLocationId: storage.id, itemId: item.id,
        cropName: cycle.cropName, storageLocationName: storage.name, harvestDate: stockDate(command.harvestDate), quantity: command.quantity, unit: "KG", grade: command.grade,
        lossQuantity: command.lossQuantity, requestHash, createdBy: scope.actorId } });
      const base = { ...where, itemId: item.id, locationId: storage.id, harvestId: row.id, occurredOn: row.harvestDate, createdBy: scope.actorId };
      await tx.stockMovement.create({ data: { ...base, quantityDelta: command.quantity, reason: "HARVEST", sourceKey: "harvest:" + row.id } });
      if (quantityUnits(command.lossQuantity) > 0n) await tx.stockMovement.create({ data: { ...base, quantityDelta: "-" + command.lossQuantity, reason: "LOSS", sourceKey: "harvest-loss:" + row.id } });
      return view(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
