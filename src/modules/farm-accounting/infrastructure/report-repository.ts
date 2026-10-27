import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import type { FarmReportRepository, ReportQuery } from "../contracts/accounting";
import type { RecognitionPayment, RecognitionRecord } from "../domain/accounting";
import { moneyString, moneyUnits } from "../domain/money";

const scoped = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const money = (value: Prisma.Decimal) => moneyString(moneyUnits(value.toFixed(4)));
const day = (value: Date) => value.toISOString().slice(0, 10);
const dates = ({ from, to }: ReportQuery) => from || to ? { ...(from ? { gte: new Date(from + "T00:00:00.000Z") } : {}), ...(to ? { lte: new Date(to + "T00:00:00.000Z") } : {}) } : undefined;
const recordSelect = { id: true, kind: true, amount: true, currency: true, occurredOn: true, status: true, enterpriseId: true, categoryId: true, categoryName: true } satisfies Prisma.AccountingRecordSelect;
type RecordRow = Prisma.AccountingRecordGetPayload<{ select: typeof recordSelect }>;
const recognition = (row: RecordRow): RecognitionRecord => ({
  recordId: row.id, kind: row.kind, amount: money(row.amount), currency: row.currency, occurredOn: day(row.occurredOn), status: row.status,
  enterpriseId: row.enterpriseId, categoryId: row.categoryId, categoryName: row.categoryName,
});

/**
 * Reads only the POSTED sources a report needs, filtered in SQL by date. Reversed records/payments are
 * excluded here and again by recognizedEvents(); a farm's history is expected to stay small in Phase 4
 * (rebuildable projections are Phase 8).
 */
export function farmReportRepository(db: PrismaClient): FarmReportRepository {
  return {
    async reportSources(scope, query) {
      const where = scoped(scope), range = dates(query);
      let records: RecordRow[], payments: RecognitionPayment[] = [];
      if (query.basis === "ACCRUAL") {
        records = await db.accountingRecord.findMany({ where: { ...where, status: "POSTED", ...(range ? { occurredOn: range } : {}) }, select: recordSelect, orderBy: [{ occurredOn: "asc" }, { id: "asc" }] });
      } else {
        const paid = await db.paymentRecord.findMany({ where: { ...where, status: "POSTED", ...(range ? { paidOn: range } : {}) }, select: { id: true, direction: true, paidOn: true, status: true, allocations: { select: { obligationId: true, amount: true } } }, orderBy: [{ paidOn: "asc" }, { id: "asc" }] });
        payments = paid.map(row => ({ paymentId: row.id, direction: row.direction, paidOn: day(row.paidOn), status: row.status, allocations: row.allocations.map(a => ({ obligationId: a.obligationId, amount: money(a.amount) })) }));
        const obligationIds = [...new Set(payments.flatMap(payment => payment.allocations.map(a => a.obligationId)))];
        records = await db.accountingRecord.findMany({ where: { ...where, OR: [
          { status: "POSTED", kind: { in: ["EXPENSE", "INCOME"] }, ...(range ? { occurredOn: range } : {}) },
          ...(obligationIds.length ? [{ id: { in: obligationIds } }] : []),
        ] }, select: recordSelect, orderBy: [{ occurredOn: "asc" }, { id: "asc" }] });
      }
      const enterpriseIds = [...new Set(records.map(row => row.enterpriseId).filter((value): value is string => !!value))];
      const enterprises = enterpriseIds.length ? await db.enterprise.findMany({ where: { ...where, id: { in: enterpriseIds } }, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }) : [];
      return { records: records.map(recognition), payments, enterprises: enterprises.map(row => ({ enterpriseId: row.id, name: row.name })) };
    },
    recordExport: (scope, requestId) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId, action: "ACCOUNTING_SUMMARY_EXPORTED", targetId: scope.farmId });
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
