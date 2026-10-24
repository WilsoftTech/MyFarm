import "server-only";
import type { LivestockBatch, Prisma, PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { PoultryBatchRepository, PoultryBatchView, StartPoultryBatch } from "../contracts/poultry-batch";
import type { FarmScope } from "../domain/production";
import { assertPoultryBatchStart, currentBatchQuantity } from "../domain/poultry-batch";
import { productionAfter, requireProductionWriteAccess } from "./production-access";

type Reader = PrismaClient | Prisma.TransactionClient;
const scoped = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const batch = (db: Reader, scope: FarmScope, id: string) => db.livestockBatch.findFirst({ where: { ...scoped(scope), id } });
const view = (row: LivestockBatch): PoultryBatchView => ({
  batchId: row.id, tenantId: row.tenantId, farmId: row.farmId, enterpriseId: row.enterpriseId, batchName: row.batchName,
  animalType: row.animalType, breed: row.breed, startingQuantity: row.startingQuantity, currentQuantity: currentBatchQuantity(row),
  acquisitionDate: row.acquisitionDate.toISOString().slice(0, 10), purpose: row.purpose, status: row.status, version: row.version,
  createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
function assertReplay(row: LivestockBatch | null, command: StartPoultryBatch, actorId: string): PoultryBatchView {
  if (!row || row.createdBy !== actorId) throw new FoundationError("CONFLICT");
  const result = view(row);
  if (result.enterpriseId !== command.enterpriseId || result.batchName !== command.batchName || result.animalType !== command.animalType ||
    result.breed !== (command.breed ?? null) || result.startingQuantity !== command.startingQuantity ||
    result.acquisitionDate !== command.acquisitionDate || result.purpose !== command.purpose) throw new FoundationError("CONFLICT");
  return result;
}

export function poultryBatchRepository(db: PrismaClient): PoultryBatchRepository {
  return {
    async poultryBatch(scope, id) { const row = await batch(db, scope, id); return row ? view(row) : null; },
    async poultryBatches(scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await batch(db, scope, cursor)) : {};
      const rows = await db.livestockBatch.findMany({ where: { ...scoped(scope), ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(view);
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].batchId : null };
    },
    startPoultryBatch: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "POULTRY_BATCH_STARTED", targetId: id });
      // Recheck after a possible receipt wait: a revoked member must not replay or create.
      await requireProductionWriteAccess(tx, scope);
      if (replay) return assertReplay(await batch(tx, scope, replay), command, scope.actorId);
      const where = scoped(scope);
      const enterprise = await tx.enterprise.findFirst({ where: { ...where, id: command.enterpriseId } });
      if (!enterprise) throw new FoundationError("FORBIDDEN");
      assertPoultryBatchStart(scope, command, { ...where, enterpriseId: enterprise.id, type: enterprise.type, status: enterprise.status });
      const row = await tx.livestockBatch.create({ data: {
        id, ...where, enterpriseId: enterprise.id, batchName: command.batchName, animalType: command.animalType, breed: command.breed,
        startingQuantity: command.startingQuantity, acquisitionDate: new Date(command.acquisitionDate + "T00:00:00.000Z"),
        purpose: command.purpose, createdBy: scope.actorId,
      } });
      return view(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
