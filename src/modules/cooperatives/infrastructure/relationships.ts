import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { ownerFarm } from "@/modules/extension-officers/infrastructure/repository";
import type { CreateCooperative, RelationshipCommand, Receipt } from "../contracts/cooperative";
import { activeAccount, member, mutate, type Tx } from "./access";

export function createCooperative(db: PrismaClient, actorId: string, command: CreateCooperative) {
  return mutate(db, actorId, command.organizationId, command, "CREATE", async tx => {
    const existing = await tx.organization.findUnique({ where: { id: command.organizationId } });
    if (existing) await member(tx, actorId, command.organizationId, ["MANAGER"]);
  }, async tx => {
    if (await tx.organization.findUnique({ where: { id: command.organizationId } })) throw new FoundationError("CONFLICT");
    await tx.organization.create({ data: { id: command.organizationId, name: command.name, kind: "ORGANIZATION" } });
    await tx.cooperativeMember.create({ data: { organizationId: command.organizationId, userId: actorId, invitedBy: actorId, role: "MANAGER", status: "ACTIVE" } });
    return { targetId: command.organizationId, version: 1 };
  });
}
export function relationship(db: PrismaClient, actorId: string, organizationId: string, command: RelationshipCommand) {
  const authorize = async (tx: Tx) => {
    if (command.type === "INVITE" || command.type === "REVOKE_MEMBER") return member(tx, actorId, organizationId, ["MANAGER"]);
    if (command.type === "SHARE") { await member(tx, actorId, organizationId, ["FARMER"]); return ownerFarm(tx, actorId, command.farmId); }
    if (command.type === "REVOKE_SHARE") {
      // Owners may withdraw consent even after their institutional membership is revoked.
      const share = await tx.cooperativeShare.findFirst({ where: { id: command.shareId, organizationId, grantedBy: actorId } });
      if (!share) throw new FoundationError("FORBIDDEN");
      return ownerFarm(tx, actorId, share.farmId);
    }
    const row = await tx.cooperativeMember.findFirst({ where: { id: command.memberId, organizationId, userId: actorId, status: { in: ["INVITED", "ACTIVE"] } } });
    if (!row) throw new FoundationError("FORBIDDEN");
    return row;
  };
  // Retain the granted role in immutable receipt/audit actions through later re-invitations.
  const action = command.type === "INVITE" ? "INVITE_" + command.role : command.type;
  return mutate(db, actorId, organizationId, command, action, authorize, async (tx): Promise<Receipt> => {
    if (command.type === "INVITE") {
      await activeAccount(tx, command.userId);
      // A new explicit invitation is a fresh consent cycle. Old grants remain revoked.
      const previous = await tx.cooperativeMember.findUnique({ where: { organizationId_userId: { organizationId, userId: command.userId } } });
      if (previous) {
        if (previous.status !== "REVOKED") throw new FoundationError("CONFLICT");
        const row = await tx.cooperativeMember.update({ where: { id: previous.id }, data: { role: command.role, invitedBy: actorId, status: "INVITED", version: { increment: 1 } } });
        return { targetId: row.id, version: row.version };
      }
      const row = await tx.cooperativeMember.create({ data: { organizationId, userId: command.userId, invitedBy: actorId, role: command.role, status: "INVITED" } });
      return { targetId: row.id, version: row.version };
    }
    if (command.type === "SHARE") {
      const farm = await ownerFarm(tx, actorId, command.farmId);
      if (await tx.cooperativeShare.findFirst({ where: { organizationId, farmId: farm.id, revokedAt: null } })) throw new FoundationError("CONFLICT");
      const row = await tx.cooperativeShare.create({ data: { organizationId, farmId: farm.id, tenantId: farm.tenantId, grantedBy: actorId, shareLocation: command.shareLocation, shareProduction: command.shareProduction } });
      return { targetId: row.id, version: row.version };
    }
    if (command.type === "REVOKE_SHARE") {
      const result = await tx.cooperativeShare.updateMany({ where: { id: command.shareId, organizationId, grantedBy: actorId, version: command.expectedVersion, revokedAt: null }, data: { revokedAt: new Date(), version: { increment: 1 } } });
      if (result.count !== 1) throw new FoundationError("CONFLICT");
      return { targetId: command.shareId, version: command.expectedVersion + 1 };
    }
    const row = await tx.cooperativeMember.findFirst({ where: { id: command.memberId, organizationId, version: command.expectedVersion }, include: { user: { select: { status: true } } } });
    if (!row) throw new FoundationError("CONFLICT");
    if (command.type === "ACCEPT" && (row.userId !== actorId || row.status !== "INVITED")) throw new FoundationError("FORBIDDEN");
    if (command.type === "REVOKE_MEMBER") {
      if (row.status === "REVOKED") throw new FoundationError("CONFLICT");
      if (row.role === "MANAGER" && row.status === "ACTIVE" && row.user.status === "ACTIVE" && await tx.cooperativeMember.count({ where: { organizationId, role: "MANAGER", status: "ACTIVE", user: { status: "ACTIVE" } } }) <= 1) throw new FoundationError("CONFLICT");
      // Revoked membership cannot revive the old farm-sharing consent later.
      await tx.cooperativeShare.updateMany({ where: { organizationId, grantedBy: row.userId, revokedAt: null }, data: { revokedAt: new Date(), version: { increment: 1 } } });
    }
    await tx.cooperativeMember.update({ where: { id: row.id }, data: { status: command.type === "ACCEPT" ? "ACTIVE" : "REVOKED", version: { increment: 1 } } });
    return { targetId: row.id, version: row.version + 1 };
  });
}
