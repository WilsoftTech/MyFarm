import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { EXPORT_FILES, type ExportColumn, type ExportFile } from "../domain/catalog";
import type { ExportPhoto, FarmExportRepository } from "../contracts/export";

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;
const cell = (column: ExportColumn, index: number) =>
  (column.kind === "time" ? `to_char(${column.sql} AT TIME ZONE 'UTC', ${ISO})` : `${column.sql}::text`) + ` AS c${index}`;
/** Built only from the fixed catalog; the farm, tenant and (for "mine") the person exporting are bound parameters. */
function tableSql(file: ExportFile): string {
  const where = file.scope === "self" ? `"id" = $1::uuid AND "tenantId" = $2::uuid`
    : file.scope === "mine" ? `"farmId" = $1::uuid AND "tenantId" = $2::uuid AND "actorId" = $3::uuid` : `"farmId" = $1::uuid AND "tenantId" = $2::uuid`;
  return `SELECT ${file.columns.map(cell).join(", ")} FROM "${file.table}" WHERE ${where}${file.only ? " AND " + file.only : ""} ORDER BY "createdAt", "id"`;
}
const tableParams = (file: ExportFile, scope: { farmId: string; tenantId: string; actorId: string }) => file.scope === "mine" ? [scope.farmId, scope.tenantId, scope.actorId] : [scope.farmId, scope.tenantId];
// Every column gets its own name: rows are read in order, and two unnamed columns would collide.
const PROFILE_SQL = "SELECT " + [`p.name`, `p.phone`, `p."alternativePhone"`, `p.district`, `p.subcounty`, `p.village`, `p."preferredLanguage"`, `p."ownershipType"::text`,
  `array_to_string(p."mainActivities"::text[], ';')`, `to_char(p."createdAt" AT TIME ZONE 'UTC', ${ISO})`, `to_char(p."updatedAt" AT TIME ZONE 'UTC', ${ISO})`].map((sql, index) => sql + " AS c" + index).join(", ")
  + ` FROM "FarmerProfile" p JOIN "Farmer" f ON f.id = p."farmerId" WHERE f."userId" = $1::uuid`;
const text = (row: Record<string, unknown>) => Object.values(row).map(value => value === null || value === undefined ? "" : String(value));

export function farmExportRepository(db: PrismaClient): FarmExportRepository {
  return {
    snapshot: (scope, requestId) => db.$transaction(async (tx: Prisma.TransactionClient) => {
      await requireProductionWriteAccess(tx, scope);
      const tables = [];
      for (const file of EXPORT_FILES) tables.push({ file: file.file, rows: (await tx.$queryRawUnsafe<Record<string, unknown>[]>(tableSql(file), ...tableParams(file, scope))).map(text) });
      const profile = (await tx.$queryRawUnsafe<Record<string, unknown>[]>(PROFILE_SQL, scope.actorId)).map(text);
      await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId, action: "FARM_EXPORTED", targetId: scope.farmId });
      return { tables, profile };
    }, { isolationLevel: "RepeatableRead", timeout: 30_000 }),
    async photos(scope, after, limit) {
      const anchor = after ? await db.recordPhoto.findFirst({ where: { id: after, farmId: scope.farmId, tenantId: scope.tenantId }, select: { id: true, createdAt: true } }) : null;
      const rows = await db.recordPhoto.findMany({
        where: { farmId: scope.farmId, tenantId: scope.tenantId, ...(anchor ? { OR: [{ createdAt: { gt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { gt: anchor.id } }] } : {}) },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit, select: { id: true, createdAt: true, activityId: true, accountingRecordId: true },
      });
      return rows.map((row): ExportPhoto => ({ photoId: row.id, createdAt: row.createdAt.toISOString(), target: row.activityId ? "ACTIVITY" : row.accountingRecordId ? "ACCOUNTING_RECORD" : null, recordId: row.activityId ?? row.accountingRecordId }));
    },
  };
}
