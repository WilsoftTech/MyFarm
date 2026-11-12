import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { requireProductionWriteAccess } from "@/modules/enterprises-seasons/infrastructure/production-access";
import { shownAnswer, type StoredAnswers } from "../domain/exchange";
import type { AssistantExchange, AssistantRepository, AssistantScope, Intent } from "../contracts/assistant";

const select = { id: true, farmId: true, question: true, intent: true, answers: true, createdAt: true, retentionUntil: true } as const;
type Row = { id: string; farmId: string; question: string; intent: Intent; answers: unknown; createdAt: Date; retentionUntil: Date };
const exchange = (row: Row): AssistantExchange => ({
  questionId: row.id, question: row.question, intent: row.intent, askedAt: row.createdAt.toISOString(), keptUntil: row.retentionUntil.toISOString(),
  // Written only by this server in the versioned shape the table's check enforces.
  answers: (row.answers as StoredAnswers).answers.map(shownAnswer),
});
const own = (scope: AssistantScope) => ({ tenantId: scope.tenantId, farmId: scope.farmId, actorId: scope.actorId });

/**
 * Questions are private to the person who asked (D-P11-003): every read and delete names tenant, farm and actor.
 * The table sets both times on the database clock, so retention cannot be stretched by the app's clock.
 */
export function assistantRepository(db: PrismaClient): AssistantRepository {
  return {
    async byRequest(scope, requestId) {
      const row = await db.assistantQuestion.findFirst({ where: { ...own(scope), requestId, retentionUntil: { gt: new Date() } }, select });
      return row ? exchange(row) : null;
    },
    async record(scope, input) {
      return db.$transaction(async tx => {
        await requireProductionWriteAccess(tx, scope);
        // The person's questions past 90 days go as they ask again (D-P11-003); unattended deletion waits for the owner (D-P09-012).
        await tx.$executeRaw`DELETE FROM "AssistantQuestion" WHERE "actorId" = ${scope.actorId}::uuid AND "retentionUntil" <= now()`;
        const inserted = await tx.$executeRaw`INSERT INTO "AssistantQuestion" (id, "tenantId", "farmId", "actorId", "requestId", question, intent, answers, provider, model)
          VALUES (${crypto.randomUUID()}::uuid, ${scope.tenantId}::uuid, ${scope.farmId}::uuid, ${scope.actorId}::uuid, ${input.requestId}::uuid, ${input.question}, ${input.intent}::"AssistantIntent",
            ${JSON.stringify(input.answers)}::jsonb, ${input.provider}, ${input.model})
          ON CONFLICT ("actorId", "requestId") DO NOTHING`;
        // Usage is logged once, with the question that caused it; a concurrent retry that lost the race logs nothing.
        if (inserted === 1 && input.usage) {
          const usage = input.usage;
          await tx.$executeRaw`INSERT INTO "AssistantUsage" (id, "tenantId", "farmId", provider, model, calls, "inputTokens", "outputTokens", "costEstimateUsd")
            VALUES (${crypto.randomUUID()}::uuid, ${scope.tenantId}::uuid, ${scope.farmId}::uuid, ${usage.provider}, ${usage.model}, ${usage.calls}, ${usage.inputTokens}, ${usage.outputTokens}, ${usage.costEstimateUsd}::numeric)`;
        }
        const row = await tx.assistantQuestion.findFirst({ where: { actorId: scope.actorId, requestId: input.requestId }, select });
        // The same request ID already used for another farm or tenant.
        if (!row || row.farmId !== scope.farmId) throw new FoundationError("CONFLICT");
        return exchange(row);
      });
    },
    async list(scope, limit) {
      const rows = await db.assistantQuestion.findMany({ where: { ...own(scope), retentionUntil: { gt: new Date() } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select });
      return rows.map(exchange);
    },
    async remove(scope, questionId) {
      return (await db.assistantQuestion.deleteMany({ where: { ...own(scope), id: questionId } })).count === 1;
    },
  };
}
