import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { claimCommandReceipt } from "@/modules/engineering-foundation/infrastructure/command-receipts";
import { officerDashboard } from "../domain/dashboard";
import { officerPermissionSchema, type AssignmentFact } from "../contracts/dashboard";
import type { AssignmentView, GrantOfficer, RevokeOfficer } from "../contracts/assignments";
import type { OfficerReadRepository } from "../contracts/service";

type Tx = Prisma.TransactionClient;
const CAP = 10_000;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const view = (r: { id: string; officerId: string; permissions: string[]; version: number; validFrom: Date; revokedAt: Date | null }): AssignmentView => ({ assignmentId: r.id, officerId: r.officerId, permissions: r.permissions, version: r.version, grantedAt: r.validFrom.toISOString(), revokedAt: r.revokedAt?.toISOString() ?? null });

export async function ownerFarm(tx: Tx, actorId: string, farmId: string) {
  const farm = await tx.farm.findFirst({ where: { id: farmId, owner: { userId: actorId, user: { status: "ACTIVE" } },
    members: { some: { userId: actorId, role: "OWNER", status: "ACTIVE" } } } });
  if (!farm || !await tx.membership.findFirst({ where: { userId: actorId, organizationId: farm.tenantId, role: "FARMER", status: "ACTIVE" } })) throw new FoundationError("FORBIDDEN");
  return farm;
}
export async function requireAgent(tx: Tx, actorId: string, organizationId?: string) {
  const account = await tx.user.findFirst({ where: { id: actorId, status: "ACTIVE", memberships: { some: { ...(organizationId ? { organizationId } : {}), role: "AGENT", status: "ACTIVE" } } } });
  if (!account) throw new FoundationError("FORBIDDEN");
  return account;
}
async function clock(tx: Tx) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row.now;
}
export function officerRepository(db: PrismaClient) {
  const read: OfficerReadRepository = {
    dashboard: (actorId, organizationId, cursor) => db.$transaction(async tx => {
      const account = await requireAgent(tx, actorId, organizationId), now = await clock(tx);
      const rows = await tx.officerAssignment.findMany({ where: { officerId: actorId, revokedAt: null, validFrom: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        include: { farm: { include: { owner: { include: { user: { include: { memberships: { where: { role: "FARMER", status: "ACTIVE" } } } } } }, members: { where: { role: "OWNER", status: "ACTIVE" } } } } },
        orderBy: { id: "asc" }, take: CAP + 1 });
      const facts: AssignmentFact[] = rows.slice(0, CAP).map(row => ({ id: row.id, tenantId: row.tenantId, farmId: row.farmId, farmerId: row.farmerId,
        officerId: row.officerId, grantedByOwnerId: row.grantedByOwnerId, currentOwnerId: row.farm.owner.userId,
        ownerActive: row.farm.ownerFarmerId === row.farmerId && row.farm.owner.user.status === "ACTIVE"
          && row.farm.members.some(m => m.userId === row.farm.owner.userId)
          && row.farm.owner.user.memberships.some(m => m.organizationId === row.tenantId),
        validFrom: row.validFrom.toISOString(), expiresAt: row.expiresAt?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null,
        permissions: row.permissions.map(value => officerPermissionSchema.parse(value)),
      }));
      const active = facts.filter(row => row.ownerActive && row.grantedByOwnerId === row.currentOwnerId && row.permissions.includes("DASHBOARD"));
      const assignmentIds = active.map(row => row.id);
      const visits = await tx.officerVisit.findMany({ where: { officerId: actorId, assignmentId: { in: assignmentIds } }, select: { id: true, farmId: true, tenantId: true, officerId: true, scheduledOn: true, status: true }, orderBy: { id: "asc" }, take: CAP + 1 });
      const visitIds = visits.slice(0, CAP).map(row => row.id);
      const followUps = await tx.officerFollowUp.findMany({ where: { officerId: actorId, visitId: { in: visitIds } }, select: { id: true, farmId: true, tenantId: true, officerId: true, dueOn: true, status: true }, orderBy: { id: "asc" }, take: CAP + 1 });
      const problems = await tx.officerProblem.findMany({ where: { officerId: actorId, visitId: { in: visitIds } }, select: { id: true, farmId: true, tenantId: true, officerId: true, visitId: true, explicitlyFlagged: true, resolved: true }, orderBy: { id: "asc" }, take: CAP + 1 });
      const byFarm = new Map(active.map(row => [row.farmId, row]));
      const parent = (row: { farmId: string; tenantId: string; officerId: string }) => ({ farmId: row.farmId, tenantId: row.tenantId, officerId: row.officerId, farmerId: byFarm.get(row.farmId)?.farmerId });
      const dashboard = officerDashboard(account, { organizationId, name: "", role: "AGENT", status: "ACTIVE" }, {
        coverage: [rows, visits, followUps, problems].some(items => items.length > CAP) ? "PARTIAL" : "COMPLETE", assignments: facts,
        visits: visits.slice(0, CAP).map(row => ({ ...parent(row), id: row.id, scheduledOn: row.scheduledOn.toISOString().slice(0, 10), status: row.status })),
        followUps: followUps.slice(0, CAP).map(row => ({ ...parent(row), id: row.id, dueOn: row.dueOn.toISOString().slice(0, 10), status: row.status })),
        problems: problems.slice(0, CAP).map(row => ({ ...parent(row), id: row.id, visitId: row.visitId, explicitlyFlagged: row.explicitlyFlagged, resolved: row.resolved })),
      }, now);
      if (cursor && !active.some(row => row.id === cursor)) throw new FoundationError("FORBIDDEN");
      const page = active.filter(row => !cursor || row.id > cursor).slice(0, 51);
      const farms = page.slice(0, 50).map(row => {
        const source = rows.find(item => item.id === row.id);
        if (!source) throw new FoundationError("UNAVAILABLE");
        return { assignmentId: row.id, farmId: row.farmId, tenantId: row.tenantId, farmerId: row.farmerId, name: source.farm.name, district: source.farm.district, version: source.version, permissions: row.permissions };
      });
      return { dashboard, farms, nextCursor: page.length > 50 ? farms[49].assignmentId : null, officerAccountId: actorId };
    }, { isolationLevel: "RepeatableRead", timeout: 15_000 }),
  };
  return { ...read,
    assignments: (actorId: string, farmId: string, cursor: string | null = null) => db.$transaction(async tx => {
      const farm = await ownerFarm(tx, actorId, farmId);
      const anchor = cursor ? await tx.officerAssignment.findFirst({ where: { id: cursor, farmId, tenantId: farm.tenantId } }) : null;
      if (cursor && !anchor) throw new FoundationError("FORBIDDEN");
      const after = anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {};
      const rows = await tx.officerAssignment.findMany({ where: { farmId, tenantId: farm.tenantId, ...after }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 101 });
      return { items: rows.slice(0, 100).map(view), truncated: rows.length > 100, nextCursor: rows.length > 100 ? rows[99].id : null };
    }),
    grant: async (actorId: string, farmId: string, command: GrantOfficer) => {
      try { return await db.$transaction(async tx => {
        const farm = await ownerFarm(tx, actorId, farmId);
        await requireAgent(tx, command.officerId);
        const id = crypto.randomUUID(), digest = hash(command);
        const replay = await claimCommandReceipt(tx, { actorId, tenantId: farm.tenantId, requestId: command.requestId, action: "OFFICER_GRANTED", targetId: id });
        await ownerFarm(tx, actorId, farmId);
        await requireAgent(tx, command.officerId);
        if (replay) {
          const row = await tx.officerAssignment.findFirst({ where: { id: replay, farmId, tenantId: farm.tenantId, requestHash: digest, grantedByOwnerId: actorId } });
          if (!row) throw new FoundationError("CONFLICT");
          return view(row);
        }
        return view(await tx.officerAssignment.create({ data: { id, tenantId: farm.tenantId, farmId, farmerId: farm.ownerFarmerId, officerId: command.officerId, grantedByOwnerId: actorId, permissions: [...command.permissions].sort(), requestHash: digest } }));
      }); } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FoundationError("CONFLICT");
        throw error;
      }
    },
    revoke: (actorId: string, farmId: string, command: RevokeOfficer) => db.$transaction(async tx => {
      const farm = await ownerFarm(tx, actorId, farmId);
      const replay = await claimCommandReceipt(tx, { actorId, tenantId: farm.tenantId, requestId: command.requestId, action: "OFFICER_REVOKED", targetId: command.assignmentId });
      await ownerFarm(tx, actorId, farmId);
      const row = await tx.officerAssignment.findFirst({ where: { id: command.assignmentId, farmId, tenantId: farm.tenantId } });
      if (!row) throw new FoundationError("FORBIDDEN");
      if (replay) {
        if (replay !== row.id || !row.revokedAt || row.version !== command.expectedVersion + 1) throw new FoundationError("CONFLICT");
        return view(row);
      }
      const result = await tx.officerAssignment.updateMany({ where: { id: row.id, version: command.expectedVersion, revokedAt: null }, data: { revokedAt: await clock(tx), version: { increment: 1 } } });
      if (result.count !== 1) throw new FoundationError("CONFLICT");
      return view(await tx.officerAssignment.findUniqueOrThrow({ where: { id: row.id } }));
    }),
  };
}
