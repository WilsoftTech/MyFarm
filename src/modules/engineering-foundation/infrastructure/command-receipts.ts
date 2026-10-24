import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { FoundationError } from "../domain/errors";

/** Claim and read under the same transaction as the domain write. The unique key serializes retries. */
export async function claimCommandReceipt(tx: Prisma.TransactionClient, input: {
  actorId: string; tenantId: string; action: string; targetId: string; requestId: string;
}): Promise<string | null> {
  const id = crypto.randomUUID();
  await tx.auditEvent.createMany({ data: [{ id, ...input }], skipDuplicates: true });
  const prior = await tx.auditEvent.findUnique({ where: { tenantId_requestId_action: {
    tenantId: input.tenantId, requestId: input.requestId, action: input.action,
  } } });
  if (!prior || prior.actorId !== input.actorId || !prior.targetId) throw new FoundationError("CONFLICT");
  return prior.id === id ? null : prior.targetId;
}
