import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, CooperativeMember } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { ownerFarm } from "@/modules/extension-officers/infrastructure/repository";
import { cooperativeRole, type CooperativeRole, type MemberView, type Receipt } from "../contracts/cooperative";
export type Tx = Prisma.TransactionClient;
export const memberView = (row: CooperativeMember): MemberView => ({ id: row.id, userId: row.userId, role: cooperativeRole.parse(row.role), status: row.status, version: row.version });
export async function activeAccount(tx: Tx, actorId: string) {
  if (!await tx.user.findFirst({ where: { id: actorId, status: "ACTIVE" } })) throw new FoundationError("FORBIDDEN");
}
export async function member(tx: Tx, actorId: string, organizationId: string, roles?: readonly CooperativeRole[]) {
  await activeAccount(tx, actorId);
  const row = await tx.cooperativeMember.findFirst({ where: { organizationId, userId: actorId, status: "ACTIVE", organization: { kind: "ORGANIZATION" } } });
  if (!row || (roles && !roles.includes(cooperativeRole.parse(row.role)))) throw new FoundationError("FORBIDDEN");
  return row;
}
export async function currentShare(tx: Tx, organizationId: string, shareId: string, production = false) {
  const share = await tx.cooperativeShare.findFirst({ where: { id: shareId, organizationId, revokedAt: null } });
  if (!share || (production && !share.shareProduction)) throw new FoundationError("FORBIDDEN");
  await member(tx, share.grantedBy, organizationId, ["FARMER"]);
  const farm = await ownerFarm(tx, share.grantedBy, share.farmId);
  if (farm.tenantId !== share.tenantId) throw new FoundationError("FORBIDDEN");
  return { share, farm };
}
/** One lock per organization serializes ledger, membership, consent and retry changes.
 * Current authority is loaded only after waiting. Read projections use a consistent snapshot.
 */
export async function mutate(db: PrismaClient, actorId: string, organizationId: string, command: { requestId: string }, action: string,
  authorize: (tx: Tx) => Promise<unknown>, work: (tx: Tx) => Promise<Receipt>): Promise<Receipt> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"cooperative:" + organizationId}, 0))::text`;
    await activeAccount(tx, actorId); await authorize(tx);
    const digest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    const prior = await tx.cooperativeReceipt.findUnique({ where: { organizationId_requestId: { organizationId, requestId: command.requestId } } });
    if (prior) {
      if (prior.actorId !== actorId || prior.action !== action || prior.requestHash !== digest) throw new FoundationError("CONFLICT");
      return { targetId: prior.targetId, version: prior.targetVersion };
    }
    const result = await work(tx);
    const priorAudit = await claimCommandReceipt(tx, { actorId, tenantId: organizationId, requestId: command.requestId, action: "COOP_" + action, targetId: result.targetId });
    // A complete retry returned above. An orphan audit must never attest to a different new write.
    if (priorAudit !== null) throw new FoundationError("CONFLICT");
    await tx.cooperativeReceipt.create({ data: { organizationId, actorId, requestId: command.requestId, action, requestHash: digest, targetId: result.targetId, targetVersion: result.version } });
    return result;
  }, { timeout: 15_000 });
}
