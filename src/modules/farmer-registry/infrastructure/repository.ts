import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import type { FarmerProfileData, FarmerView, FarmView, RegistryRepository } from "../contracts/registry";
import { PREFERRED_LANGUAGES, type PreferredLanguage } from "../domain/rules";

type Tx = Prisma.TransactionClient;
type RegistryAction = "FARMER_REGISTERED" | "FARMER_PROFILE_UPDATED" | "FARM_CREATED" | "PLOT_CREATED";
const PLOT_LIMIT = 200;

/**
 * Request IDs are idempotency receipts stored as audit events (unique tenant/request/action).
 * A concurrent duplicate blocks on the unique index until the first transaction finishes,
 * then observes the committed receipt and replays its target instead of writing again.
 */
async function claimReceipt(tx: Tx, input: { actorId: string; tenantId: string; action: RegistryAction; targetId: string; requestId: string }) {
const id = crypto.randomUUID();
await tx.auditEvent.createMany({ data: [{ id, ...input }], skipDuplicates: true });
const existing = await tx.auditEvent.findUnique({ where: { tenantId_requestId_action: { tenantId: input.tenantId, requestId: input.requestId, action: input.action } } });
if (!existing || existing.actorId !== input.actorId || !existing.targetId) throw new FoundationError("CONFLICT");
return existing.id === id ? null : existing.targetId;
}

function language(value: string): PreferredLanguage {
const match = PREFERRED_LANGUAGES.find(code => code === value);
if (!match) throw new FoundationError("UNAVAILABLE");
return match;
}
const decimal = (value: Prisma.Decimal | null) => value === null ? null : value.toString();
const profileColumns = (profile: FarmerProfileData) => ({
name: profile.name, phone: profile.phone, alternativePhone: profile.alternativePhone ?? null, district: profile.district,
subcounty: profile.subcounty ?? null, village: profile.village ?? null, preferredLanguage: profile.preferredLanguage,
ownershipType: profile.ownershipType, mainActivities: profile.mainActivities,
});

async function readFarmer(db: Tx | PrismaClient, where: { userId: string } | { id: string }): Promise<FarmerView | null> {
const row = await db.farmer.findUnique({ where, include: { profile: true } });
if (!row?.profile) return null;
const p = row.profile;
return { farmerId: row.id, tenantId: row.tenantId, version: p.version, name: p.name, phone: p.phone, alternativePhone: p.alternativePhone, district: p.district, subcounty: p.subcounty, village: p.village, preferredLanguage: language(p.preferredLanguage), ownershipType: p.ownershipType, mainActivities: p.mainActivities };
}

async function translateConstraint<T>(work: () => Promise<T>): Promise<T> {
try { return await work(); }
catch (error) {
if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new FoundationError("CONFLICT");
throw error;
}
}

export function registryRepository(db: PrismaClient): RegistryRepository {
return {
farmerForUser: userId => readFarmer(db, { userId }),

registerFarmer: ({ userId, requestId, profile }) => translateConstraint(() => db.$transaction(async tx => {
const tenantId = crypto.randomUUID(), farmerId = crypto.randomUUID();
await tx.organization.create({ data: { id: tenantId, name: profile.name, kind: "PERSONAL" } });
await tx.membership.create({ data: { userId, organizationId: tenantId, role: "FARMER" } });
// Unique Farmer.userId rejects a concurrent second registration and rolls back its organization.
await tx.farmer.create({ data: { id: farmerId, userId, tenantId } });
await tx.farmerProfile.create({ data: { farmerId, updatedBy: userId, ...profileColumns(profile) } });
await claimReceipt(tx, { actorId: userId, tenantId, action: "FARMER_REGISTERED", targetId: farmerId, requestId });
const farmer = await readFarmer(tx, { id: farmerId });
if (!farmer) throw new FoundationError("UNAVAILABLE");
return farmer;
})),

updateProfile: ({ farmerId, tenantId, actorId, requestId, expectedVersion, profile }) => db.$transaction(async tx => {
const replayed = await claimReceipt(tx, { actorId, tenantId, action: "FARMER_PROFILE_UPDATED", targetId: farmerId, requestId });
if (replayed === null) {
const { count } = await tx.farmerProfile.updateMany({ where: { farmerId, version: expectedVersion, farmer: { tenantId } }, data: { ...profileColumns(profile), updatedBy: actorId, version: { increment: 1 } } });
// Stale version: reject and roll back the receipt so a corrected retry can proceed.
if (count !== 1) throw new FoundationError("CONFLICT");
} else if (replayed !== farmerId) throw new FoundationError("CONFLICT");
const farmer = await readFarmer(tx, { id: farmerId });
if (!farmer || farmer.tenantId !== tenantId) throw new FoundationError("FORBIDDEN");
return farmer;
}),

async farmsForMember({ userId, tenantId, cursor, limit }) {
const rows = await db.farm.findMany({
where: { tenantId, members: { some: { userId, status: "ACTIVE" } } },
orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
select: { id: true, name: true, district: true, primaryActivity: true, approximateAcreage: true, _count: { select: { plots: true } } },
});
const items = rows.slice(0, limit).map(row => ({ farmId: row.id, name: row.name, district: row.district, primaryActivity: row.primaryActivity, approximateAcreage: decimal(row.approximateAcreage), plotCount: row._count.plots }));
return { items, nextCursor: rows.length > limit ? items[items.length - 1].farmId : null };
},

async farmForMember({ userId, farmId }): Promise<FarmView | null> {
const row = await db.farm.findFirst({
where: { id: farmId, members: { some: { userId, status: "ACTIVE" } } },
include: { plots: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: PLOT_LIMIT + 1 } },
});
if (!row) return null;
return {
farmId: row.id, tenantId: row.tenantId, name: row.name, district: row.district, subcounty: row.subcounty, village: row.village,
approximateAcreage: decimal(row.approximateAcreage), ownershipType: row.ownershipType, primaryActivity: row.primaryActivity,
latitude: decimal(row.latitude), longitude: decimal(row.longitude), version: row.version,
plots: row.plots.slice(0, PLOT_LIMIT).map(plot => ({ plotId: plot.id, name: plot.name, area: decimal(plot.area), areaUnit: plot.areaUnit })),
plotsTruncated: row.plots.length > PLOT_LIMIT,
};
},

createFarm: ({ tenantId, farmerId, actorId, requestId, farm }) => translateConstraint(() => db.$transaction(async tx => {
const farmId = crypto.randomUUID();
const replayed = await claimReceipt(tx, { actorId, tenantId, action: "FARM_CREATED", targetId: farmId, requestId });
if (replayed) return { farmId: replayed };
await tx.farm.create({ data: {
id: farmId, tenantId, ownerFarmerId: farmerId, createdBy: actorId, name: farm.name, district: farm.district,
subcounty: farm.subcounty ?? null, village: farm.village ?? null, ownershipType: farm.ownershipType, primaryActivity: farm.primaryActivity,
approximateAcreage: farm.approximateAcreage ?? null, latitude: farm.latitude ?? null, longitude: farm.longitude ?? null,
} });
await tx.farmMember.create({ data: { farmId, userId: actorId, tenantId, role: "OWNER" } });
return { farmId };
})),

createPlot: ({ tenantId, farmId, actorId, requestId, plot }) => translateConstraint(() => db.$transaction(async tx => {
const plotId = crypto.randomUUID();
const replayed = await claimReceipt(tx, { actorId, tenantId, action: "PLOT_CREATED", targetId: plotId, requestId });
if (replayed) return { plotId: replayed };
// Composite (farmId, tenantId) foreign key rejects any plot whose farm belongs to another tenant.
await tx.plot.create({ data: { id: plotId, tenantId, farmId, createdBy: actorId, name: plot.name, area: plot.area ?? null, areaUnit: plot.areaUnit ?? null } });
return { plotId };
})),
};
}
