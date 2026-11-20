import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, VoiceExpenseDraft } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { ProductionWriteScope } from "@/modules/enterprises-seasons/contracts/production";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { createAccountingRecord, validateAccountingRecord, withBatchEnterprise } from "@/modules/farm-accounting/infrastructure/repository";
import { voiceReviewSchema, type VoiceExpenseReview } from "../contracts/voice";
import type { VoiceDraftRepository, VoiceDraftView, VoiceExpenseReceipt } from "../contracts/drafts";
import { assertPendingReview, assertVoiceConfirmation, confirmationPayload } from "../domain/confirmation";

const where = (scope: ProductionWriteScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId, actorId: scope.actorId });
/** Schema parsing fixes property order/decimal representation. Empty optional fields are omitted. */
const jsonReview = (review: VoiceExpenseReview): Prisma.InputJsonObject => {
  const parsed = voiceReviewSchema.parse(review);
  return { schemaVersion: parsed.schemaVersion, kind: parsed.kind,
    command: Object.fromEntries(Object.entries(parsed.command).filter((entry): entry is [string, string] => typeof entry[1] === "string")),
    bags: parsed.bags };
};
const hash = (scope: ProductionWriteScope, review: VoiceExpenseReview, version: number) =>
  createHash("sha256").update(confirmationPayload(scope, review, version)).digest("hex");
async function view(row: VoiceExpenseDraft, tx: Prisma.TransactionClient): Promise<VoiceDraftView> {
  const review = voiceReviewSchema.parse(row.review), command = review.command;
  const scope = { tenantId: row.tenantId, farmId: row.farmId };
  const [category, method, enterprise, season, plot, batch] = await Promise.all([
    tx.transactionCategory.findUnique({ where: { id: command.categoryId }, select: { name: true } }),
    command.paymentMethodId ? tx.paymentMethod.findUnique({ where: { id: command.paymentMethodId }, select: { name: true } }) : null,
    command.enterpriseId ? tx.enterprise.findFirst({ where: { ...scope, id: command.enterpriseId }, select: { name: true } }) : null,
    command.seasonId ? tx.season.findFirst({ where: { ...scope, id: command.seasonId }, select: { label: true } }) : null,
    command.plotId ? tx.plot.findFirst({ where: { ...scope, id: command.plotId }, select: { name: true } }) : null,
    command.batchId ? tx.poultryBatch.findFirst({ where: { ...scope, id: command.batchId }, select: { batchLabel: true } }) : null,
  ]);
  if (!category || (command.paymentMethodId && !method) || (command.enterpriseId && !enterprise) || (command.seasonId && !season) || (command.plotId && !plot) || (command.batchId && !batch)) throw new FoundationError("CONFLICT");
  return { draftId: row.id, farmId: row.farmId, review, version: row.version, payloadHash: row.payloadHash, expiresAt: row.expiresAt.toISOString(),
    labels: { category: category.name, paymentMethod: method?.name ?? null, enterprise: enterprise?.name ?? null, season: season?.label ?? null, plot: plot?.name ?? null, batch: batch?.batchLabel ?? null } };
}
const receipt = (row: VoiceExpenseDraft): VoiceExpenseReceipt => {
  if (!row.accountingRecordId || !row.confirmedAt) throw new FoundationError("CONFLICT");
  return { draftId: row.id, recordId: row.accountingRecordId, version: row.version, payloadHash: row.payloadHash, confirmedAt: row.confirmedAt.toISOString() };
};
async function clock(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row.now;
}
async function pending(tx: Prisma.TransactionClient, row: VoiceExpenseDraft) {
  assertPendingReview(row.expiresAt.toISOString(), row.confirmedAt !== null, await clock(tx));
}
async function locked(tx: Prisma.TransactionClient, scope: ProductionWriteScope, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "VoiceExpenseDraft"
    WHERE id = ${id}::uuid AND "tenantId" = ${scope.tenantId}::uuid AND "farmId" = ${scope.farmId}::uuid AND "actorId" = ${scope.actorId}::uuid FOR UPDATE`;
  await requireProductionWriteAccess(tx, scope);
  if (!rows.length) throw new FoundationError("FORBIDDEN");
  return tx.voiceExpenseDraft.findUniqueOrThrow({ where: { id } });
}
async function reviewed(tx: Prisma.TransactionClient, scope: ProductionWriteScope, input: VoiceExpenseReview) {
  const command = await withBatchEnterprise(tx, scope, { ...input.command, requestId: input.command.requestId.toLowerCase() });
  await validateAccountingRecord(tx, scope, "EXPENSE", command);
  return voiceReviewSchema.parse({ ...input, command });
}
const transactionOptions = { isolationLevel: "ReadCommitted", timeout: 10_000 } as const;

export function voiceDraftRepository(db: PrismaClient): VoiceDraftRepository {
  return {
    create: (scope, input) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      // Actor/request serialization also prevents the same mutation being rebound to another farm.
      const requestId = input.command.requestId.toLowerCase();
      const key = "myfarm:voice-draft:" + scope.actorId + ":" + requestId;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
      await requireProductionWriteAccess(tx, scope);
      const prior = await tx.voiceExpenseDraft.findUnique({ where: { actorId_requestId: { actorId: scope.actorId, requestId } } });
      const review = await reviewed(tx, scope, input);
      if (prior) {
        if (prior.farmId !== scope.farmId || prior.tenantId !== scope.tenantId || prior.version !== 1 || prior.payloadHash !== hash(scope, review, 1)) throw new FoundationError("CONFLICT");
        await pending(tx, prior);
        return view(prior, tx);
      }
      const createdAt = await clock(tx);
      const row = await tx.voiceExpenseDraft.create({ data: {
        createdAt, expiresAt: new Date(createdAt.getTime() + 30 * 60_000),
        id: randomUUID(), ...where(scope), requestId: review.command.requestId, review: jsonReview(review), payloadHash: hash(scope, review, 1),
      } });
      await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId, action: "VOICE_EXPENSE_DRAFTED", requestId: row.requestId, targetId: row.id });
      return view(row, tx);
    }, transactionOptions),
    read: (scope, id) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const row = await tx.voiceExpenseDraft.findFirst({ where: { ...where(scope), id } });
      if (!row) throw new FoundationError("FORBIDDEN");
      await pending(tx, row);
      return view(row, tx);
    }, transactionOptions),
    outcome: (scope, id) => db.$transaction(async tx => {
      await requireProductionWriteAccess(tx, scope);
      const row = await tx.voiceExpenseDraft.findFirst({ where: { ...where(scope), id } });
      if (!row) throw new FoundationError("FORBIDDEN");
      if (row.confirmedAt) return { status: "COMPLETED", receipt: receipt(row) };
      if (row.expiresAt <= await clock(tx)) return { status: "EXPIRED" };
      return { status: "PENDING", draft: await view(row, tx) };
    }, transactionOptions),
    edit: (scope, id, input) => db.$transaction(async tx => {
      const row = await locked(tx, scope, id);
      await pending(tx, row);
      if (input.review.command.requestId.toLowerCase() !== row.requestId) throw new FoundationError("CONFLICT");
      const review = await reviewed(tx, scope, input.review);
      if (row.version === input.version + 1 && row.payloadHash === hash(scope, review, row.version)) return view(row, tx);
      if (row.version !== input.version) throw new FoundationError("CONFLICT");
      const saved = await tx.voiceExpenseDraft.update({ where: { id }, data: {
        review: jsonReview(review), version: { increment: 1 }, payloadHash: hash(scope, review, row.version + 1),
      } });
      await tx.auditEvent.create({ data: { actorId: scope.actorId, tenantId: scope.tenantId, action: "VOICE_EXPENSE_DRAFT_EDITED", requestId: randomUUID(), targetId: id } });
      return view(saved, tx);
    }, transactionOptions),
    confirm: (scope, id, input) => db.$transaction(async tx => {
      const row = await locked(tx, scope, id);
      const review = voiceReviewSchema.parse(row.review);
      assertVoiceConfirmation(scope, { actorId: row.actorId, tenantId: row.tenantId, farmId: row.farmId, requestId: row.requestId, version: row.version, payloadHash: row.payloadHash,
        expiresAt: row.expiresAt.toISOString(), completed: row.confirmedAt !== null }, input, hash(scope, review, row.version), await clock(tx));
      // A committed identical retry survives expiry, but only after the current access check above.
      if (row.confirmedAt) return receipt(row);
      await pending(tx, row);
      const recordId = randomUUID();
      const replay = await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId,
        action: "ACCOUNTING_EXPENSE_RECORDED", requestId: row.requestId, targetId: recordId });
      await requireProductionWriteAccess(tx, scope);
      if (replay) throw new FoundationError("CONFLICT");
      await createAccountingRecord(tx, scope, "EXPENSE", review.command, recordId);
      // The DB trigger checks expiry using wall time here too, after any validation/receipt waits.
      const confirmedAt = await clock(tx);
      if (row.expiresAt <= confirmedAt) throw new FoundationError("CONFLICT");
      const saved = await tx.voiceExpenseDraft.update({ where: { id }, data: { accountingRecordId: recordId, confirmedAt } });
      await claimCommandReceipt(tx, { actorId: scope.actorId, tenantId: scope.tenantId,
        action: "VOICE_EXPENSE_CONFIRMED", requestId: row.requestId, targetId: id });
      return receipt(saved);
    }, transactionOptions),
  };
}
