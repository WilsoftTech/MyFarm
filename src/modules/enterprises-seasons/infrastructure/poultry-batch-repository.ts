import "server-only";
import { Prisma, type PoultryBatch, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { PoultryBatchRepository, PoultryBatchView, StartPoultryBatch } from "../contracts/poultry-batch";
import type { FarmScope } from "../domain/production";
import { assertPoultryBatchStart, batchLabelKey, currentQuantity } from "../domain/poultry-batch";
import { productionAfter, requireProductionWriteAccess } from "./production-access";

type Reader = PrismaClient | Prisma.TransactionClient;
const scoped = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const batch = (db: Reader, scope: FarmScope, id: string) => db.poultryBatch.findFirst({ where: { ...scoped(scope), id } });
const view = (row: PoultryBatch): PoultryBatchView => ({
  batchId: row.id, tenantId: row.tenantId, farmId: row.farmId, enterpriseId: row.enterpriseId, animalTypeId: row.animalTypeId,
  animalTypeName: row.animalTypeName, breed: row.breed, batchLabel: row.batchLabel, startingQuantity: row.startingQuantity,
  ...currentQuantity(row.startingQuantity), acquisitionDate: row.acquisitionDate.toISOString().slice(0, 10), purpose: row.purpose,
  status: row.status, version: row.version, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
async function currentViews(db: Reader, scope: FarmScope, rows: PoultryBatch[]): Promise<PoultryBatchView[]> {
  const items = await db.inventoryItem.findMany({ where: { ...scoped(scope), kind: "BIRD", batchId: { in: rows.map(r => r.id) } }, select: { id: true, batchId: true } });
  const sums = await db.stockMovement.groupBy({ by: ["itemId"], where: { ...scoped(scope), itemId: { in: items.map(r => r.id) } }, _sum: { quantityDelta: true } });
  return rows.map(r => {
    const item = items.find(i => i.batchId === r.id);
    if (!item) return view(r);
    const total = Number(sums.find(s => s.itemId === item.id)?._sum.quantityDelta?.toString() ?? "0");
    if (!Number.isInteger(total) || total < 0 || total > 2_147_483_647) throw new FoundationError("CONFLICT");
    return { ...view(r), currentQuantity: total, currentQuantitySource: "PRODUCTION_LEDGER" };
  });
}
function assertReplay(row: PoultryBatch | null, command: StartPoultryBatch, actorId: string): PoultryBatchView {
  if (!row || row.createdBy !== actorId) throw new FoundationError("CONFLICT");
  const result = view(row);
  if (result.enterpriseId !== command.enterpriseId || result.animalTypeId !== command.animalTypeId || result.breed !== (command.breed ?? null) ||
    result.batchLabel !== command.batchLabel || result.startingQuantity !== command.startingQuantity || result.acquisitionDate !== command.acquisitionDate ||
    result.purpose !== command.purpose) throw new FoundationError("CONFLICT");
  return result;
}

export function poultryBatchRepository(db: PrismaClient): PoultryBatchRepository {
  return {
    async animalTypes(_scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await db.animalTypeCatalog.findFirst({ where: { id: cursor, active: true } })) : {};
      const rows = await db.animalTypeCatalog.findMany({ where: { active: true, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(row => ({ animalTypeId: row.id, name: row.name }));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].animalTypeId : null };
    },
    async poultryBatch(scope, id) { const row = await batch(db, scope, id); return row ? (await currentViews(db, scope, [row]))[0] : null; },
    async poultryBatches(scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await batch(db, scope, cursor)) : {};
      const rows = await db.poultryBatch.findMany({ where: { ...scoped(scope), ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = await currentViews(db, scope, rows.slice(0, limit));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].batchId : null };
    },
    startPoultryBatch: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "POULTRY_BATCH_STARTED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) return assertReplay(await batch(tx, scope, replay), command, scope.actorId);
      const where = scoped(scope);
      const enterprise = await tx.enterprise.findFirst({ where: { ...where, id: command.enterpriseId } });
      if (!enterprise) throw new FoundationError("FORBIDDEN");
      const animalType = await tx.animalTypeCatalog.findUnique({ where: { id: command.animalTypeId } });
      if (!animalType) throw new FoundationError("INVALID_INPUT");
      assertPoultryBatchStart(scope, command, {
        enterprise: { ...where, enterpriseId: enterprise.id, type: enterprise.type, status: enterprise.status },
        animalType: { animalTypeId: animalType.id, name: animalType.name, active: animalType.active },
      });
      await requireProductionWriteAccess(tx, scope);
      try {
        // The unique farm/label-key index decides competing labels; the loser waits, then conflicts.
        const row = await tx.poultryBatch.create({ data: {
          id, ...where, enterpriseId: enterprise.id, animalTypeId: animalType.id, animalTypeName: animalType.name, breed: command.breed,
          batchLabel: command.batchLabel, batchLabelKey: batchLabelKey(command.batchLabel), startingQuantity: command.startingQuantity,
          acquisitionDate: new Date(command.acquisitionDate + "T00:00:00.000Z"), purpose: command.purpose, createdBy: scope.actorId,
        } });
        return view(row);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FoundationError("CONFLICT");
        throw error;
      }
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
