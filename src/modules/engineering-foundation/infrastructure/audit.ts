import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { AuditPort, UnitOfWork } from "../contracts/storage";
import { FoundationError } from "../domain/errors";
function auditRepository(db: Prisma.TransactionClient): AuditPort {
return { async append(input) {
// Serialize grants per actor across instances. Retries reuse the existing receipt.
await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.actorId}, 0))`;
const prior = await db.auditEvent.findUnique({ where: { tenantId_requestId_action: { tenantId: input.tenantId, requestId: input.requestId, action: input.action } } });
if (prior) {
if (prior.actorId !== input.actorId || prior.targetId !== input.targetId) throw new FoundationError("CONFLICT");
return;
}
const counts = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) AS count FROM "AuditEvent" WHERE "actorId" = ${input.actorId}::uuid AND action = 'PRIVATE_FILE_READ' AND "occurredAt" > clock_timestamp() - interval '1 minute'`;
if (counts[0].count >= 30n) throw new FoundationError("RATE_LIMITED");
await db.auditEvent.createMany({ data: [input], skipDuplicates: true });
const existing = await db.auditEvent.findUnique({ where: { tenantId_requestId_action: { tenantId: input.tenantId, requestId: input.requestId, action: input.action } } });
if (!existing || existing.actorId !== input.actorId || existing.targetId !== input.targetId) throw new FoundationError("CONFLICT");
} };
}
export function unitOfWork(db: PrismaClient): UnitOfWork { return { run: work => db.$transaction(tx => work(auditRepository(tx))) }; }
export function auditService(db: PrismaClient): AuditPort { return { append: input => db.$transaction(tx => auditRepository(tx).append(input)) }; }
