import "server-only";
import type { PrismaClient, ProductionEvent } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { requireProductionWriteAccess, productionAfter } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { createAccountingRecord } from "@/modules/farm-accounting/infrastructure/repository";
import type { PoultryProductionRepository, ProductionEventView } from "../contracts/production";
import { assertProductionQuantity, reconstructFlock } from "../domain/production";
import { reconstructStock } from "../domain/stock";
import { movementDelta } from "./stock-repository";
import { commandHash, stockDate, stockScope } from "./harvest-repository";

const eventView = (r: ProductionEvent, reversed = false): ProductionEventView => ({ reversed, eventId: r.id, batchId: r.batchId, type: r.type, quantity: r.quantity.toString(), unit: r.unit, occurredOn: r.occurredOn.toISOString().slice(0, 10), note: r.note, accountingRecordId: r.accountingRecordId });
export function poultryProductionRepository(db: PrismaClient): PoultryProductionRepository {
  return {
    async events(scope,batchId,{cursor,limit}) {
      const where=stockScope(scope);if(!await db.poultryBatch.findFirst({where:{...where,id:batchId}}))throw new FoundationError("FORBIDDEN");
      const anchor=cursor?productionAfter(await db.productionEvent.findFirst({where:{...where,batchId,id:cursor}})):{};
      const rows=await db.productionEvent.findMany({where:{...where,batchId,...anchor},orderBy:[{createdAt:"desc"},{id:"desc"}],take:limit+1});
      const reversals=await db.stockOperation.findMany({where:{...where,reversalKey:{in:rows.map(r=>"PRODUCTION:"+r.id)}},select:{targetId:true}});
      return {items:rows.slice(0,limit).map(r=>eventView(r,reversals.some(v=>v.targetId===r.id))),nextCursor:rows.length>limit?rows[limit-1].id:null};
    },
    async event(scope,id) {const where=stockScope(scope),row=await db.productionEvent.findFirst({where:{...where,id}});const reversed=Boolean(await db.stockOperation.findFirst({where:{...where,reversalKey:"PRODUCTION:"+id}}));return row?eventView(row,reversed):null;},
    async summary(scope, batchId) {
      const where = stockScope(scope), batch = await db.poultryBatch.findFirst({ where: { ...where, id: batchId } });
      if (!batch) throw new FoundationError("FORBIDDEN");
      const rows = await db.productionEvent.findMany({ where: { ...where, batchId }, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 101 });
      const reversals=await db.stockOperation.findMany({where:{...where,reversalKey:{in:rows.map(r=>"PRODUCTION:"+r.id)}},select:{targetId:true}});
      const bird = await db.inventoryItem.findFirst({ where: { ...where, batchId, kind: "BIRD" } });
      const balance = bird ? await db.stockMovement.aggregate({ where: { ...where, itemId: bird.id }, _sum: { quantityDelta: true } }) : null;
      const current = bird ? Number(balance?._sum.quantityDelta?.toString() ?? "0") : batch.startingQuantity;
      return { batchId, startingQuantity: batch.startingQuantity, currentQuantity: reconstructFlock(current, []), asOf: new Date().toISOString(), events: rows.slice(0, 100).map(r=>eventView(r,reversals.some(v=>v.targetId===r.id))), historyTruncated: rows.length > 100 };
    },
    record: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = stockScope(scope), id = crypto.randomUUID(), requestHash = commandHash(command);
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "POULTRY_PRODUCTION_RECORDED", targetId: id });
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:poultry-stock:" + command.batchId}, 0))::text`;
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const prior = await tx.productionEvent.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, requestHash } });
        if (!prior) throw new FoundationError("CONFLICT");
        return eventView(prior);
      }
      const batch = await tx.poultryBatch.findFirst({ where: { ...where, id: command.batchId } });
      const location = await tx.storageLocation.findFirst({ where: { ...where, id: command.locationId } });
      if (!batch || !location) throw new FoundationError("FORBIDDEN");
      if (batch.status !== "ACTIVE") throw new FoundationError("CONFLICT");
      if (command.occurredOn < batch.acquisitionDate.toISOString().slice(0, 10)) throw new FoundationError("INVALID_INPUT");
      assertProductionQuantity(command);
      let bird = await tx.inventoryItem.findFirst({ where: { ...where, batchId: batch.id, kind: "BIRD" } });
      if (!bird) {
        bird = await tx.inventoryItem.create({ data: { ...where, name: batch.batchLabel, kind: "BIRD", unit: "BIRD", batchId: batch.id, createdBy: scope.actorId } });
        if (batch.startingQuantity > 0) await tx.stockMovement.create({ data: { ...where, itemId: bird.id, locationId: location.id, openingBatchId: batch.id,
          quantityDelta: String(batch.startingQuantity), reason: "OPENING", sourceKey: "batch-opening:" + batch.id, occurredOn: batch.acquisitionDate, createdBy: scope.actorId } });
      }
      const flockBalance = await tx.stockMovement.aggregate({ where: { ...where, itemId: bird.id }, _sum: { quantityDelta: true } });
      reconstructFlock(Number(flockBalance._sum.quantityDelta?.toString() ?? "0"), [command]);
      let item = bird;
      if (command.type === "EGGS") {
        const eggs = await tx.inventoryItem.findFirst({ where: { ...where, batchId: batch.id, kind: "EGG" } });
        item = eggs ?? await tx.inventoryItem.create({ data: { ...where, name: batch.batchLabel, kind: "EGG", unit: "EGG", batchId: batch.id, createdBy: scope.actorId } });
      }
      let accountingRecordId: string | undefined;
      if (command.sale) {
        const sale = await createAccountingRecord(tx, scope, "SALE", { ...command.sale, requestId: command.requestId, occurredOn: command.occurredOn, enterpriseId: batch.enterpriseId, plotId: undefined, seasonId: undefined }, crypto.randomUUID());
        accountingRecordId = sale.recordId;
      }
      const row = await tx.productionEvent.create({ data: { id, ...where, batchId: batch.id, locationId: location.id, type: command.type, quantity: command.quantity, unit: command.unit,
        occurredOn: stockDate(command.occurredOn), note: command.note, requestHash, accountingRecordId, createdBy: scope.actorId } });
      if (command.type !== "FEED" && command.type !== "MEDICATION") {
        const negative = command.type === "MORTALITY" || command.type === "BIRD_SALE";
        const balance = await tx.stockMovement.aggregate({ where: { ...where, itemId: item.id, locationId: location.id }, _sum: { quantityDelta: true } });
        if (negative && (balance._sum.quantityDelta?.lessThan(command.quantity) ?? true)) throw new FoundationError("CONFLICT");
        const history = await tx.stockMovement.findMany({ where: { ...where, itemId: item.id } });
        reconstructStock([...history.map(movementDelta), { itemId: item.id, locationId: location.id, occurredOn: command.occurredOn, quantityDelta: (negative ? "-" : "") + command.quantity }]);
        await tx.stockMovement.create({ data: { ...where, itemId: item.id, locationId: location.id, productionEventId: row.id, quantityDelta: (negative ? "-" : "") + command.quantity,
          reason: command.type, sourceKey: "production:" + row.id, occurredOn: row.occurredOn, createdBy: scope.actorId } });
      }
      return eventView(row);
    }, { timeout: 10_000, isolationLevel: "ReadCommitted" }),
  };
}
