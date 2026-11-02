import "server-only";
import type { PrismaClient, RecordPhoto } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import type { PhotoRepository, PhotoView } from "../contracts/photos";
import type { PhotoTarget } from "../domain/commands";

const farmWhere = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const targetColumn = (target: PhotoTarget, recordId: string) => target === "ACTIVITY" ? { activityId: recordId } : { accountingRecordId: recordId };
const view = (r: RecordPhoto): PhotoView => ({ photoId: r.id, tenantId: r.tenantId, farmId: r.farmId, target: r.activityId ? "ACTIVITY" : "ACCOUNTING_RECORD", recordId: r.activityId ?? r.accountingRecordId ?? "", contentType: r.contentType, byteSize: r.byteSize, createdBy: r.createdBy, createdAt: r.createdAt.toISOString() });

export function photoRepository(db: PrismaClient): PhotoRepository {
  return {
    async recordExists(scope, target, recordId) {
      const where = { ...farmWhere(scope), id: recordId };
      return target === "ACTIVITY" ? Boolean(await db.productionActivity.findFirst({ where, select: { id: true } })) : Boolean(await db.accountingRecord.findFirst({ where, select: { id: true } }));
    },
    async photo(scope, id) { const row = await db.recordPhoto.findFirst({ where: { ...farmWhere(scope), id } }); return row ? { ...view(row), sha256: row.sha256 } : null; },
    async photos(scope, target, recordId) {
      const rows = await db.recordPhoto.findMany({ where: { ...farmWhere(scope), ...targetColumn(target, recordId) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 });
      return rows.map(view);
    },
    async receiptActions(scope, requestId) { return (await db.auditEvent.findMany({ where: { tenantId: scope.tenantId, requestId }, select: { action: true } })).map(row => row.action); },
    record: (scope, command, byteSize) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const where = farmWhere(scope), id = command.requestId;
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "RECORD_PHOTO_ADDED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) {
        const row = await tx.recordPhoto.findFirst({ where: { ...where, id: replay, createdBy: scope.actorId, sha256: command.sha256 } });
        if (!row) throw new FoundationError("CONFLICT");
        return view(row);
      }
      return view(await tx.recordPhoto.create({ data: { id, ...where, ...targetColumn(command.target, command.recordId), contentType: command.contentType, byteSize, sha256: command.sha256, createdBy: scope.actorId } }));
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
