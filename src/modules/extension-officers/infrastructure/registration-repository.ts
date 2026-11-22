import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { createFarmWithin, registerFarmerWithin } from "@/modules/farmer-registry/infrastructure/repository";
import { registrationReviewSchema, type OfficerWorkRepository, type RegistrationDraftView } from "../contracts/work";
import { registrationConfirmation } from "../domain/registration";
import { requireAgent, ownerFarm } from "./repository";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function officerRegistrationRepository(db: PrismaClient): Pick<OfficerWorkRepository, "prepare" | "draft" | "accept" | "discard"> {
  return {
    prepare: (actorId, organizationId, command) => db.$transaction(async tx => {
      await requireAgent(tx, actorId, organizationId);
      if (!await tx.user.findFirst({ where: { id: command.targetUserId, status: "ACTIVE" } })) throw new FoundationError("FORBIDDEN");
      await tx.officerRegistrationDraft.deleteMany({ where: { officerId: actorId, farmId: null, expiresAt: { lte: new Date() } } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"officer-registration:" + command.requestId}, 0))`;
      await requireAgent(tx, actorId, organizationId);
      const row = await tx.officerRegistrationDraft.findUnique({ where: { id: command.requestId } });
      if (row) {
        if (row.officerId !== actorId || row.organizationId !== organizationId || row.targetUserId !== command.targetUserId || row.payloadHash !== digest(command.review)) throw new FoundationError("CONFLICT");
        return { draftId: row.id };
      }
      if (await tx.auditEvent.findFirst({ where: { tenantId: organizationId, requestId: command.requestId, action: { startsWith: "OFFICER_REGISTRATION_" } } })) throw new FoundationError("CONFLICT");
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      await tx.officerRegistrationDraft.create({ data: { id: command.requestId, officerId: actorId, organizationId, targetUserId: command.targetUserId, review: command.review, payloadHash: digest(command.review), createdAt: clock.now, expiresAt: new Date(clock.now.getTime() + 7 * 86_400_000) } });
      await claimCommandReceipt(tx, { actorId, tenantId: organizationId, requestId: command.requestId, action: "OFFICER_REGISTRATION_PREPARED", targetId: command.requestId });
      return { draftId: command.requestId };
    }),
    draft: async (actorId, draftId) => {
      const result = await db.$transaction(async tx => {
        const row = await tx.officerRegistrationDraft.findFirst({ where: { id: draftId, OR: [{ officerId: actorId }, { targetUserId: actorId }] } });
        if (!row) throw new FoundationError("FORBIDDEN");
        if (row.farmId === null && row.expiresAt.getTime() <= Date.now()) {
          await tx.officerRegistrationDraft.delete({ where: { id: row.id } });
          return null;
        }
        if (row.officerId === actorId) {
          await requireAgent(tx, actorId, row.organizationId);
          // An officer's completed receipt contains no copied profile; the farmer owns the result.
          if (row.farmId) throw new FoundationError("FORBIDDEN");
        }
        if (row.farmId) await ownerFarm(tx, actorId, row.farmId);
        return { draftId: row.id, officerAccountId: row.officerId, review: row.farmId ? null : registrationReviewSchema.parse(row.review), payloadHash: row.payloadHash, version: row.version, expiresAt: row.expiresAt.toISOString(), acceptedFarmId: row.farmId, canAccept: row.targetUserId === actorId } satisfies RegistrationDraftView;
      });
      if (!result) throw new FoundationError("CONFLICT");
      return result;
    },
    accept: (actorId, draftId, command) => db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "OfficerRegistrationDraft" WHERE id=${draftId}::uuid FOR UPDATE`;
      const row = await tx.officerRegistrationDraft.findFirst({ where: { id: draftId, targetUserId: actorId } });
      const account = await tx.user.findFirst({ where: { id: actorId, status: "ACTIVE" } });
      if (!row || !account) throw new FoundationError("FORBIDDEN");
      const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      const operation = registrationConfirmation(account, { targetUserId: row.targetUserId, version: row.version, payloadHash: row.payloadHash, expiresAt: row.expiresAt.toISOString(), acceptedFarmId: row.farmId, discardedAt: null }, command, clock.now);
      if (operation === "REPLAY") {
        if (!row.farmId) throw new FoundationError("CONFLICT");
        await ownerFarm(tx, actorId, row.farmId);
        return { farmId: row.farmId };
      }
      await requireAgent(tx, row.officerId, row.organizationId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"officer-registration-target:" + actorId}, 0))`;
      if (!await tx.user.findFirst({ where: { id: actorId, status: "ACTIVE" } })) throw new FoundationError("FORBIDDEN");
      // A proposal never silently rewrites an existing farmer profile.
      if (await tx.farmer.findUnique({ where: { userId: actorId } })) throw new FoundationError("CONFLICT");
      const review = registrationReviewSchema.parse(row.review);
      if (digest(review) !== row.payloadHash) throw new FoundationError("CONFLICT");
      const farmer = await registerFarmerWithin(tx, { userId: actorId, requestId: row.id, profile: review.profile });
      const result = await createFarmWithin(tx, { actorId, farmerId: farmer.farmerId, tenantId: farmer.tenantId, requestId: row.id, farm: review.farm });
      await requireAgent(tx, row.officerId, row.organizationId);
      const [beforeGrant] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
      if (beforeGrant.now.getTime() >= row.expiresAt.getTime()) throw new FoundationError("CONFLICT");
      await tx.officerAssignment.create({ data: { id: crypto.randomUUID(), tenantId: farmer.tenantId, farmId: result.farmId, farmerId: farmer.farmerId, officerId: row.officerId, grantedByOwnerId: actorId, permissions: ["DASHBOARD", "VISITS", "FOLLOW_UPS"], requestHash: row.payloadHash } });
      await claimCommandReceipt(tx, { actorId, tenantId: farmer.tenantId, requestId: row.id, action: "OFFICER_REGISTRATION_ACCEPTED", targetId: result.farmId });
      // Retain the immutable consent digest/receipt, not another copy of personal profile fields.
      await tx.officerRegistrationDraft.update({ where: { id: row.id }, data: { farmId: result.farmId, tenantId: farmer.tenantId, acceptedAt: clock.now, version: { increment: 1 }, review: Prisma.JsonNull } });
      return result;
    }, { timeout: 15_000 }),
    discard: (actorId, draftId) => db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "OfficerRegistrationDraft" WHERE id=${draftId}::uuid FOR UPDATE`;
      const row = await tx.officerRegistrationDraft.findFirst({ where: { id: draftId, farmId: null, OR: [{ officerId: actorId }, { targetUserId: actorId }] } });
      if (!row) throw new FoundationError("FORBIDDEN");
      await claimCommandReceipt(tx, { actorId, tenantId: row.organizationId, requestId: row.id, action: "OFFICER_REGISTRATION_DISCARDED", targetId: row.id });
      await tx.officerRegistrationDraft.delete({ where: { id: row.id } });
    }),
  };
}
