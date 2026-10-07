import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { AuditPort, UnitOfWork } from "../contracts/storage";
import { FoundationError } from "../domain/errors";
function auditRepository(db: Prisma.TransactionClient): AuditPort {
return { async append(input) {
await db.auditEvent.createMany({ data: [input], skipDuplicates: true });
const existing = await db.auditEvent.findUnique({ where: { tenantId_requestId_action: { tenantId: input.tenantId, requestId: input.requestId, action: input.action } } });
if (!existing || existing.actorId !== input.actorId || existing.targetId !== input.targetId) throw new FoundationError("CONFLICT");
} };
}
export function unitOfWork(db: PrismaClient): UnitOfWork { return { run: work => db.$transaction(tx => work(auditRepository(tx))) }; }
export function auditService(db: PrismaClient): AuditPort { return auditRepository(db); }
