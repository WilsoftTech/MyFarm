import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { createHash } from "node:crypto";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import type { OfficerWorkRepository, VisitView } from "../contracts/work";
import { ownerFarm, requireAgent } from "./repository";

type Tx = Prisma.TransactionClient;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function assignedVisitAccess(tx: Tx, actorId: string, organizationId: string, farmId: string, assignmentId: string, permission: "VISITS" | "FOLLOW_UPS") {
  await requireAgent(tx, actorId, organizationId);
  const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  const row = await tx.officerAssignment.findFirst({ where: { id: assignmentId, officerId: actorId, farmId, revokedAt: null, validFrom: { lte: clock.now }, OR: [{ expiresAt: null }, { expiresAt: { gt: clock.now } }] } });
  if (!row || !row.permissions.includes("DASHBOARD") || !row.permissions.includes(permission)) throw new FoundationError("FORBIDDEN");
  const farm = await ownerFarm(tx, row.grantedByOwnerId, farmId);
  if (farm.ownerFarmerId !== row.farmerId || farm.tenantId !== row.tenantId) throw new FoundationError("FORBIDDEN");
  return row;
}
async function receipt(tx: Tx, actorId: string, tenantId: string, requestId: string, action: string, targetId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"officer:" + tenantId + ":" + requestId}, 0))`;
  const other = await tx.auditEvent.findFirst({ where: { tenantId, requestId, action: { startsWith: "OFFICER_", not: action } } });
  if (other) throw new FoundationError("CONFLICT");
  return claimCommandReceipt(tx, { actorId, tenantId, requestId, action, targetId });
}
async function parent(tx: Tx, actorId: string, organizationId: string, farmId: string, visitId: string, permission: "VISITS" | "FOLLOW_UPS") {
  const visit = await tx.officerVisit.findFirst({ where: { id: visitId, farmId, officerId: actorId } });
  if (!visit) throw new FoundationError("FORBIDDEN");
  await assignedVisitAccess(tx, actorId, organizationId, farmId, visit.assignmentId, permission);
  return visit;
}
export function officerVisitRepository(db: PrismaClient): Pick<OfficerWorkRepository, "recordVisit" | "visits" | "finish" | "reservePhoto" | "publishPhoto" | "readablePhoto"> {
  return {
    recordVisit: (actorId, organizationId, farmId, command) => db.$transaction(async tx => {
      const assignment = await assignedVisitAccess(tx, actorId, organizationId, farmId, command.assignmentId, "VISITS");
      if (command.followUp && !assignment.permissions.includes("FOLLOW_UPS")) throw new FoundationError("FORBIDDEN");
      const replay = await receipt(tx, actorId, assignment.tenantId, command.requestId, "OFFICER_VISIT_RECORDED", command.requestId);
      await assignedVisitAccess(tx, actorId, organizationId, farmId, assignment.id, "VISITS");
      if (replay) {
        const existing = await tx.officerVisit.findFirst({ where: { id: replay, farmId, officerId: actorId, assignmentId: assignment.id, requestHash: hash(command) } });
        if (!existing) throw new FoundationError("CONFLICT");
        return { recordId: existing.id, version: existing.version };
      }
      const common = { tenantId: assignment.tenantId, farmId, officerId: actorId };
      const row = await tx.officerVisit.create({ data: { id: command.requestId, ...common, assignmentId: assignment.id, scheduledOn: new Date(command.scheduledOn + "T00:00:00Z"), status: command.status, observations: command.observations, recommendation: command.recommendation, latitude: command.latitude ?? null, longitude: command.longitude ?? null, requestHash: hash(command) } });
      if (command.followUp) await tx.officerFollowUp.create({ data: { ...common, visitId: row.id, dueOn: new Date(command.followUp.dueOn + "T00:00:00Z"), status: "OPEN", notes: command.followUp.notes } });
      if (command.problem) await tx.officerProblem.create({ data: { ...common, visitId: row.id, explicitlyFlagged: true, description: command.problem } });
      return { recordId: row.id, version: row.version };
    }),
    visits: (actorId, organizationId, farmId, assignmentId) => db.$transaction(async tx => {
      await assignedVisitAccess(tx, actorId, organizationId, farmId, assignmentId, "VISITS");
      const rows = await tx.officerVisit.findMany({ where: { farmId, officerId: actorId, assignmentId }, include: { followUps: true, problems: true, photos: { where: { uploadedAt: { not: null } }, select: { id: true, contentType: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 } }, orderBy: [{ scheduledOn: "desc" }, { id: "desc" }], take: 50 });
      return rows.map((row): VisitView => ({ visitId: row.id, assignmentId: row.assignmentId, scheduledOn: row.scheduledOn.toISOString().slice(0, 10), status: row.status, observations: row.observations, recommendation: row.recommendation, latitude: row.latitude?.toString() ?? null, longitude: row.longitude?.toString() ?? null, version: row.version, followUps: row.followUps.map(item => ({ id: item.id, dueOn: item.dueOn.toISOString().slice(0, 10), notes: item.notes, status: item.status, version: item.version })), problems: row.problems.map(item => ({ id: item.id, description: item.description, resolved: item.resolved, version: item.version })), photos: row.photos }));
    }, { isolationLevel: "RepeatableRead" }),
    finish: (actorId, organizationId, farmId, kind, id, command) => db.$transaction(async tx => {
      const row = kind === "FOLLOW_UP" ? await tx.officerFollowUp.findFirst({ where: { id, farmId, officerId: actorId } }) : await tx.officerProblem.findFirst({ where: { id, farmId, officerId: actorId } });
      if (!row) throw new FoundationError("FORBIDDEN");
      await parent(tx, actorId, organizationId, farmId, row.visitId, kind === "FOLLOW_UP" ? "FOLLOW_UPS" : "VISITS");
      const replay = await receipt(tx, actorId, row.tenantId, command.requestId, "OFFICER_" + kind + "_FINISHED", id);
      await parent(tx, actorId, organizationId, farmId, row.visitId, kind === "FOLLOW_UP" ? "FOLLOW_UPS" : "VISITS");
      if (replay) {
        const done = kind === "FOLLOW_UP" ? await tx.officerFollowUp.findFirst({ where: { id, farmId, officerId: actorId, status: "COMPLETED", version: command.expectedVersion + 1 } }) : await tx.officerProblem.findFirst({ where: { id, farmId, officerId: actorId, resolved: true, version: command.expectedVersion + 1 } });
        if (replay !== id || !done) throw new FoundationError("CONFLICT");
        return { recordId: id, version: done.version };
      }
      const where = { id, farmId, officerId: actorId, version: command.expectedVersion };
      const result = kind === "FOLLOW_UP" ? await tx.officerFollowUp.updateMany({ where: { ...where, status: "OPEN" }, data: { status: "COMPLETED", version: { increment: 1 } } }) : await tx.officerProblem.updateMany({ where: { ...where, resolved: false }, data: { resolved: true, version: { increment: 1 } } });
      if (result.count !== 1) throw new FoundationError("CONFLICT");
      return { recordId: id, version: command.expectedVersion + 1 };
    }),
    reservePhoto: (actorId, organizationId, farmId, command) => db.$transaction(async tx => {
      const visit = await parent(tx, actorId, organizationId, farmId, command.visitId, "VISITS");
      // Serialize reserve retries without creating a completed-upload receipt before bytes exist.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"officer-photo:" + command.requestId}, 0))`;
      await parent(tx, actorId, organizationId, farmId, visit.id, "VISITS");
      const row = await tx.officerVisitPhoto.findUnique({ where: { id: command.requestId } });
      if (row) {
        if (row.officerId !== actorId || row.visitId !== visit.id || row.farmId !== farmId || row.sha256 !== command.sha256 || row.byteSize !== command.byteSize || row.contentType !== command.contentType) throw new FoundationError("CONFLICT");
        return { tenantId: row.tenantId, uploaded: row.uploadedAt !== null };
      }
      await tx.officerVisitPhoto.create({ data: { id: command.requestId, tenantId: visit.tenantId, farmId, officerId: actorId, visitId: visit.id, sha256: command.sha256, contentType: command.contentType, byteSize: command.byteSize } });
      return { tenantId: visit.tenantId, uploaded: false };
    }),
    publishPhoto: (actorId, organizationId, farmId, command) => db.$transaction(async tx => {
      const visit = await parent(tx, actorId, organizationId, farmId, command.visitId, "VISITS");
      await receipt(tx, actorId, visit.tenantId, command.requestId, "OFFICER_PHOTO_ADDED", command.requestId);
      await parent(tx, actorId, organizationId, farmId, visit.id, "VISITS");
      const row = await tx.officerVisitPhoto.findFirst({ where: { id: command.requestId, farmId, officerId: actorId, visitId: visit.id, sha256: command.sha256, byteSize: command.byteSize, contentType: command.contentType } });
      if (!row) throw new FoundationError("CONFLICT");
      if (!row.uploadedAt) await tx.officerVisitPhoto.update({ where: { id: row.id }, data: { uploadedAt: new Date() } });
      return { photoId: row.id };
    }),
    readablePhoto: (actorId, organizationId, farmId, photoId) => db.$transaction(async tx => {
      const row = await tx.officerVisitPhoto.findFirst({ where: { id: photoId, farmId, uploadedAt: { not: null } } });
      if (!row) throw new FoundationError("FORBIDDEN");
      try { await ownerFarm(tx, actorId, farmId); return { tenantId: row.tenantId, role: "FARMER" as const }; }
      catch (error) { if (!(error instanceof FoundationError) || error.code !== "FORBIDDEN") throw error; }
      if (row.officerId !== actorId) throw new FoundationError("FORBIDDEN");
      await parent(tx, actorId, organizationId, farmId, row.visitId, "VISITS");
      return { tenantId: row.tenantId, role: "AGENT" as const };
    }),
  };
}
