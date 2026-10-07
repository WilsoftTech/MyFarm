import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import type { IdentityRepository } from "../contracts/identity";
export function identityRepository(db: PrismaClient): IdentityRepository {
return {
accountBySubject: subject => db.user.findUnique({ where: { authSubject: subject }, select: { id: true, authSubject: true, status: true } }),
async scopesForUser(userId) {
const rows = await db.membership.findMany({ where: { userId, status: "ACTIVE" }, take: 100, orderBy: { organizationId: "asc" }, include: { organization: { select: { name: true } } } });
return rows.map(row => ({ organizationId: row.organizationId, name: row.organization.name, role: row.role, status: row.status }));
},
async scopeForUser(userId, organizationId) {
const row = await db.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } }, include: { organization: { select: { name: true } } } });
return row ? { organizationId: row.organizationId, name: row.organization.name, role: row.role, status: row.status } : null;
},
};
}
