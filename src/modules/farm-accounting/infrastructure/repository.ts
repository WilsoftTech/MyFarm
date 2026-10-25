import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { FarmScope } from "@/modules/enterprises-seasons/domain/production";
import { productionAfter, requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import type { AccountingRecordView, FarmAccountingRepository, PaymentView, RecordPayment, RecordSale, RecordExpense, ReversalView, ReverseAccountingRecord } from "../contracts/accounting";
import { assertAccountingRecord, assertPaymentAllocation, assertReversal, obligationBalance, OBLIGATION_KINDS, type AccountingRecordKind, type AccountingStatus, type AllocationRecord, type ObligationKind, type ObligationReference } from "../domain/accounting";
import { moneyString, moneyUnits } from "../domain/money";

type Reader = PrismaClient | Prisma.TransactionClient;
const scoped = (scope: FarmScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId });
const money = (value: Prisma.Decimal) => moneyString(moneyUnits(value.toFixed(4)));
const day = (value: Date) => value.toISOString().slice(0, 10);
const date = (value: string) => new Date(value + "T00:00:00.000Z");
const isObligation = (kind: AccountingRecordKind): kind is ObligationKind => OBLIGATION_KINDS.includes(kind as ObligationKind);
/** Serializes allocation and reversal per sale/purchase; callers pass IDs in ascending order. */
async function lockObligations(tx: Prisma.TransactionClient, ids: readonly string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"myfarm:accounting-obligation:" + id}, 0))::text`;
}

const recordInclude = { reversal: true, allocations: { include: { payment: { select: { status: true, paidOn: true, createdAt: true } } } } } satisfies Prisma.AccountingRecordInclude;
type RecordRow = Prisma.AccountingRecordGetPayload<{ include: typeof recordInclude }>;
const paymentInclude = { reversal: true, allocations: true } satisfies Prisma.PaymentRecordInclude;
type PaymentRow = Prisma.PaymentRecordGetPayload<{ include: typeof paymentInclude }>;

type ReversalRow = { reason: string; createdBy: string; createdAt: Date };
const toReversal = (row: ReversalRow): ReversalView => ({ reason: row.reason, reversedBy: row.createdBy, reversedAt: row.createdAt.toISOString() });
const reversalView = (row: ReversalRow | null): ReversalView | null => row ? toReversal(row) : null;
const obligation = (row: RecordRow): ObligationReference => ({
  tenantId: row.tenantId, farmId: row.farmId, obligationId: row.id, kind: row.kind as ObligationKind, amount: money(row.amount), currency: row.currency, occurredOn: day(row.occurredOn), status: row.status,
});
const allocations = (row: RecordRow): AllocationRecord[] => row.allocations.map(a => ({ paymentId: a.paymentId, obligationId: a.obligationId, amount: money(a.amount), status: a.payment.status }));
const recordView = (row: RecordRow): AccountingRecordView => ({
  recordId: row.id, tenantId: row.tenantId, farmId: row.farmId, kind: row.kind, categoryId: row.categoryId, categoryName: row.categoryName,
  amount: money(row.amount), currency: row.currency, occurredOn: day(row.occurredOn), counterparty: row.counterparty, paymentMethodId: row.paymentMethodId,
  plotId: row.plotId, enterpriseId: row.enterpriseId, seasonId: row.seasonId, status: row.status, reversal: reversalView(row.reversal),
  balance: isObligation(row.kind) ? obligationBalance(obligation(row), allocations(row)) : null,
  payments: [...row.allocations].sort((a, b) => a.payment.createdAt.getTime() - b.payment.createdAt.getTime() || a.paymentId.localeCompare(b.paymentId))
    .map(a => ({ paymentId: a.paymentId, amount: money(a.amount), paidOn: day(a.payment.paidOn), status: a.payment.status })),
  version: row.version, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
const paymentView = (row: PaymentRow): PaymentView => ({
  paymentId: row.id, tenantId: row.tenantId, farmId: row.farmId, direction: row.direction, amount: money(row.amount), currency: row.currency, paidOn: day(row.paidOn),
  paymentMethodId: row.paymentMethodId, externalReference: row.externalReference, status: row.status, reversal: reversalView(row.reversal),
  allocations: row.allocations.map(a => ({ obligationId: a.obligationId, amount: money(a.amount) })).sort((a, b) => a.obligationId.localeCompare(b.obligationId)),
  version: row.version, createdBy: row.createdBy, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
});
const record = (db: Reader, scope: FarmScope, id: string) => db.accountingRecord.findFirst({ where: { ...scoped(scope), id }, include: recordInclude });
const payment = (db: Reader, scope: FarmScope, id: string) => db.paymentRecord.findFirst({ where: { ...scoped(scope), id }, include: paymentInclude });

/** A retry replays only the identical normalized command by the same actor on the same farm. */
function assertRecordReplay(row: RecordRow | null, kind: AccountingRecordKind, command: RecordExpense | RecordSale, actorId: string): AccountingRecordView {
  if (!row || row.createdBy !== actorId || row.kind !== kind) throw new FoundationError("CONFLICT");
  const result = recordView(row);
  const method = "paymentMethodId" in command ? command.paymentMethodId ?? null : null;
  if (result.categoryId !== command.categoryId || result.amount !== command.amount || result.currency !== command.currency || result.occurredOn !== command.occurredOn ||
    result.counterparty !== (command.counterparty ?? null) || result.paymentMethodId !== method || result.plotId !== (command.plotId ?? null) ||
    result.enterpriseId !== (command.enterpriseId ?? null) || result.seasonId !== (command.seasonId ?? null)) throw new FoundationError("CONFLICT");
  return result;
}
function assertPaymentReplay(row: PaymentRow | null, command: RecordPayment, actorId: string): PaymentView {
  if (!row || row.createdBy !== actorId) throw new FoundationError("CONFLICT");
  const result = paymentView(row);
  const expected = command.allocations.map(a => ({ obligationId: a.obligationId, amount: a.amount })).sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  if (result.direction !== command.direction || result.amount !== command.amount || result.currency !== command.currency || result.paidOn !== command.paidOn ||
    result.paymentMethodId !== command.paymentMethodId || result.externalReference !== (command.externalReference ?? null) ||
    JSON.stringify(result.allocations) !== JSON.stringify(expected)) throw new FoundationError("CONFLICT");
  return result;
}

export function farmAccountingRepository(db: PrismaClient): FarmAccountingRepository {
  return {
    async categories(_scope, { kind, cursor, limit }) {
      const where = { active: true, ...(kind ? { kind } : {}) };
      const anchor = cursor ? productionAfter(await db.transactionCategory.findFirst({ where: { ...where, id: cursor } })) : {};
      const rows = await db.transactionCategory.findMany({ where: { ...where, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(row => ({ categoryId: row.id, kind: row.kind, name: row.name, active: row.active }));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].categoryId : null };
    },
    async paymentMethods(_scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await db.paymentMethod.findFirst({ where: { id: cursor, active: true } })) : {};
      const rows = await db.paymentMethod.findMany({ where: { active: true, ...anchor }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(row => ({ paymentMethodId: row.id, name: row.name, active: row.active }));
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].paymentMethodId : null };
    },
    async record(scope, id) { const row = await record(db, scope, id); return row ? recordView(row) : null; },
    async records(scope, { cursor, limit }) {
      const anchor = cursor ? productionAfter(await db.accountingRecord.findFirst({ where: { ...scoped(scope), id: cursor } })) : {};
      const rows = await db.accountingRecord.findMany({ where: { ...scoped(scope), ...anchor }, include: recordInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1 });
      const items = rows.slice(0, limit).map(recordView);
      return { items, nextCursor: rows.length > limit ? items[items.length - 1].recordId : null };
    },
    async payment(scope, id) { const row = await payment(db, scope, id); return row ? paymentView(row) : null; },

    recordTransaction: (scope, kind, input) => db.$transaction(async tx => {
      const command = input as RecordExpense | RecordSale;
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACCOUNTING_" + kind + "_RECORDED", targetId: id });
      await requireProductionWriteAccess(tx, scope);
      if (replay) return assertRecordReplay(await record(tx, scope, replay), kind, command, scope.actorId);
      const where = scoped(scope);
      const methodId = "paymentMethodId" in command ? command.paymentMethodId : undefined;
      const [category, method, plot, enterprise, season] = await Promise.all([
        tx.transactionCategory.findUnique({ where: { id: command.categoryId } }),
        methodId ? tx.paymentMethod.findUnique({ where: { id: methodId } }) : null,
        command.plotId ? tx.plot.findFirst({ where: { ...where, id: command.plotId } }) : null,
        command.enterpriseId ? tx.enterprise.findFirst({ where: { ...where, id: command.enterpriseId } }) : null,
        command.seasonId ? tx.season.findFirst({ where: { ...where, id: command.seasonId } }) : null,
      ]);
      if (!category || (methodId && !method)) throw new FoundationError("INVALID_INPUT");
      // Another farm's (or an unknown) link is indistinguishable from a missing one: FORBIDDEN.
      if ((command.plotId && !plot) || (command.enterpriseId && !enterprise) || (command.seasonId && !season)) throw new FoundationError("FORBIDDEN");
      assertAccountingRecord(scope, { ...command, kind, paymentMethodId: methodId }, {
        category: { categoryId: category.id, kind: category.kind, active: category.active },
        paymentMethod: method ? { paymentMethodId: method.id, active: method.active } : undefined,
        plot: plot ? { ...where, plotId: plot.id } : undefined,
        enterprise: enterprise ? { ...where, enterpriseId: enterprise.id, type: enterprise.type, status: enterprise.status } : undefined,
        season: season ? { ...where, seasonId: season.id, status: season.status } : undefined,
      });
      const row = await tx.accountingRecord.create({ data: {
        id, ...where, kind, categoryId: category.id, categoryName: category.name, amount: command.amount, currency: command.currency, occurredOn: date(command.occurredOn),
        counterparty: command.counterparty, paymentMethodId: methodId, plotId: command.plotId, enterpriseId: command.enterpriseId, seasonId: command.seasonId, createdBy: scope.actorId,
      }, include: recordInclude });
      return recordView(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),

    recordPayment: (scope, command) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACCOUNTING_PAYMENT_RECORDED", targetId: id });
      if (replay) { await requireProductionWriteAccess(tx, scope); return assertPaymentReplay(await payment(tx, scope, replay), command, scope.actorId); }
      const obligationIds = command.allocations.map(a => a.obligationId);
      await lockObligations(tx, obligationIds);
      await requireProductionWriteAccess(tx, scope);
      const where = scoped(scope);
      const [method, rows] = await Promise.all([
        tx.paymentMethod.findUnique({ where: { id: command.paymentMethodId } }),
        tx.accountingRecord.findMany({ where: { ...where, id: { in: obligationIds } }, include: recordInclude }),
      ]);
      if (!method) throw new FoundationError("INVALID_INPUT");
      const obligations = rows.filter(row => isObligation(row.kind));
      if (obligations.length !== rows.length) throw new FoundationError("INVALID_INPUT");
      assertPaymentAllocation(scope, command, { paymentMethod: { paymentMethodId: method.id, active: method.active }, obligations: obligations.map(obligation) }, obligations.flatMap(allocations));
      await tx.paymentRecord.create({ data: {
        id, ...where, direction: command.direction, amount: command.amount, currency: command.currency, paidOn: date(command.paidOn),
        paymentMethodId: method.id, externalReference: command.externalReference, createdBy: scope.actorId,
      } });
      await tx.paymentAllocation.createMany({ data: command.allocations.map(a => ({ id: crypto.randomUUID(), ...where, paymentId: id, obligationId: a.obligationId, amount: a.amount })) });
      const row = await payment(tx, scope, id);
      if (!row) throw new FoundationError("UNAVAILABLE");
      return paymentView(row);
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),

    reverse: (scope, command: ReverseAccountingRecord) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const id = crypto.randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, requestId: command.requestId, action: "ACCOUNTING_RECORD_REVERSED", targetId: id });
      const where = scoped(scope);
      if (replay) {
        await requireProductionWriteAccess(tx, scope);
        const prior = await tx.accountingReversal.findFirst({ where: { ...where, id: replay }, include: { record: { select: { kind: true } } } });
        const priorType = prior?.paymentId ? "PAYMENT" : prior?.record?.kind;
        if (!prior || prior.createdBy !== scope.actorId || (prior.recordId ?? prior.paymentId) !== command.recordId || priorType !== command.recordType || prior.reason !== command.reason) throw new FoundationError("CONFLICT");
        return { recordType: command.recordType, recordId: command.recordId, reversal: toReversal(prior) };
      }
      const isPayment = command.recordType === "PAYMENT";
      // Lock every obligation whose balance the reversal changes, in the same order as payments.
      const lockIds = isPayment ? (await tx.paymentAllocation.findMany({ where: { ...where, paymentId: command.recordId }, select: { obligationId: true } })).map(a => a.obligationId) : [command.recordId];
      await lockObligations(tx, lockIds);
      await requireProductionWriteAccess(tx, scope);
      let status: AccountingStatus, posted: AllocationRecord[] = [];
      if (isPayment) {
        const row = await payment(tx, scope, command.recordId);
        if (!row) throw new FoundationError("FORBIDDEN");
        status = row.status;
      } else {
        const row = await record(tx, scope, command.recordId);
        if (!row || row.kind !== command.recordType) throw new FoundationError("FORBIDDEN");
        status = row.status; posted = allocations(row);
      }
      assertReversal(scope, { ...where, recordType: command.recordType, recordId: command.recordId, status }, command.reason, posted);
      try {
        const reversal = await tx.accountingReversal.create({ data: {
          id, ...where, recordId: isPayment ? null : command.recordId, paymentId: isPayment ? command.recordId : null, reason: command.reason, createdBy: scope.actorId,
        } });
        const data = { status: "REVERSED" as const, version: { increment: 1 } };
        const target = { ...where, id: command.recordId, status: "POSTED" as const };
        const updated = isPayment ? await tx.paymentRecord.updateMany({ where: target, data }) : await tx.accountingRecord.updateMany({ where: target, data });
        if (updated.count !== 1) throw new FoundationError("CONFLICT");
        return { recordType: command.recordType, recordId: command.recordId, reversal: toReversal(reversal) };
      } catch (error) {
        // The unique target index is the last word on a concurrent second reversal.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FoundationError("CONFLICT");
        throw error;
      }
    }, { isolationLevel: "ReadCommitted", timeout: 10_000 }),
  };
}
