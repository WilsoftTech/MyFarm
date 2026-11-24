import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { quantityString } from "@/modules/harvest-inventory/domain/harvest";
import { reconstructStock } from "@/modules/harvest-inventory/domain/stock";
import { declaredForecasts, organizationReport } from "../domain/operations";
import type { CooperativeRepository, CooperativeView, SharedFarmView } from "../contracts/cooperative";
import { activeAccount, member, memberView } from "./access";
import { createCooperative, relationship } from "./relationships";
import { day, ledger, operation } from "./operations";

const CAP = 10_000;
export function cooperativeRepository(db: PrismaClient): CooperativeRepository {
  return {
    create: (actor, command) => createCooperative(db, actor, command),
    relationship: (actor, org, command) => relationship(db, actor, org, command),
    operation: (actor, org, command) => operation(db, actor, org, command),
    list: actorId => db.$transaction(async tx => {
      await activeAccount(tx, actorId);
      const rows = await tx.cooperativeMember.findMany({ where: { userId: actorId, status: { in: ["ACTIVE", "INVITED"] }, organization: { kind: "ORGANIZATION" } }, include: { organization: true }, orderBy: { id: "asc" }, take: 101 });
      if (rows.length > 100) throw new FoundationError("UNAVAILABLE");
      return rows.map(row => ({ id: row.organizationId, name: row.organization.name, member: memberView(row) }));
    }),
    read: (actorId, organizationId, section, cursor) => db.$transaction(async tx => {
      const actor = memberView(await member(tx, actorId, organizationId));
      const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
      const result: CooperativeView = { actorId, organizationId, name: org.name, role: actor.role, asOf: new Date().toISOString(), section, nextCursor: null, members: [], farms: [], forecasts: [], lots: [], entries: [], inventory: [], inventoryAggregates: [], payments: [], forecastTotals: [], published: [] };
      if (actor.role === "BUYER") {
        if (cursor || section !== "lots") throw new FoundationError("FORBIDDEN");
        // Buyer query never fetches private origins, prices, payment records or farmer fields.
        const lots = await tx.cooperativeLot.findMany({ where: { organizationId, published: true }, select: { id: true, product: true, unit: true }, orderBy: { id: "asc" }, take: CAP + 1 });
        const entries = await tx.cooperativeEntry.findMany({ where: { organizationId, lotId: { in: lots.slice(0, CAP).map(l => l.id) }, kind: "STOCK" }, select: { lotId: true, location: true, occurredOn: true, quantityDelta: true }, take: CAP + 1 });
        if (lots.length > CAP || entries.length > CAP) throw new FoundationError("UNAVAILABLE");
        const balances = reconstructStock(entries.map(e => ({ itemId: e.lotId, locationId: e.location, occurredOn: day(e.occurredOn), quantityDelta: e.quantityDelta.toString() })));
        const grouped = new Map<string, { product: string; unit: string; quantity: bigint }>();
        for (const lot of lots) {
          const quantity = [...balances].filter(([key]) => key.startsWith(lot.id + ":")).reduce((sum, [, q]) => sum + q, 0n);
          const key = JSON.stringify([lot.product, lot.unit]), prior = grouped.get(key);
          grouped.set(key, { product: lot.product, unit: lot.unit, quantity: (prior?.quantity ?? 0n) + quantity });
        }
        // Bound the publication projection without silently truncating it.
        if (grouped.size > 100) throw new FoundationError("UNAVAILABLE");
        result.published = [...grouped.values()].map(row => ({ ...row, quantity: quantityString(row.quantity) }));
        return result;
      }
      const shares = await tx.cooperativeShare.findMany({ where: { organizationId, revokedAt: null, ...(actor.role === "FARMER" ? { grantedBy: actorId } : {}) },
        include: { owner: { include: { cooperativeMembers: { where: { organizationId, status: "ACTIVE", role: "FARMER" } }, memberships: { where: { role: "FARMER", status: "ACTIVE" } } } }, farm: { include: { owner: true, members: { where: { role: "OWNER", status: "ACTIVE" } } } } }, orderBy: { id: "asc" }, take: CAP + 1 });
      if (shares.length > CAP) throw new FoundationError("UNAVAILABLE");
      const current = shares.filter(row => row.owner.status === "ACTIVE" && row.owner.cooperativeMembers.length > 0 && row.farm.owner.userId === row.grantedBy && row.farm.members.some(m => m.userId === row.grantedBy) && row.owner.memberships.some(m => m.organizationId === row.tenantId));
      const farms: SharedFarmView[] = current.map(row => ({ id: row.id, farmId: row.farmId, farmerId: row.farm.ownerFarmerId, name: row.farm.name, district: row.farm.district, latitude: row.shareLocation ? row.farm.latitude?.toString() ?? null : null, longitude: row.shareLocation ? row.farm.longitude?.toString() ?? null : null, shareLocation: row.shareLocation, shareProduction: row.shareProduction, version: row.version }));
      const forecasts = await tx.cooperativeForecast.findMany({ where: { organizationId, shareId: { in: current.filter(s => s.shareProduction).map(s => s.id) }, cancelledAt: null }, orderBy: { id: "asc" }, take: CAP + 1 });
      if (forecasts.length > CAP) throw new FoundationError("UNAVAILABLE");
      const forecastRows = forecasts.map(row => ({ id: row.id, shareId: row.shareId, product: row.product, unit: row.unit, quantity: row.quantity.toString(), harvestFrom: day(row.harvestFrom), harvestTo: day(row.harvestTo), version: row.version }));
      if (actor.role === "AGENT" && section !== "farms" && section !== "forecasts") throw new FoundationError("FORBIDDEN");
      // Organization history remains with its organization after consent withdrawal;
      // a farmer sees only their own procurement history through the original grant.
      const ownShares = actor.role === "FARMER" ? await tx.cooperativeShare.findMany({ where: { organizationId, grantedBy: actorId }, select: { id: true }, take: CAP + 1 }) : [];
      if (ownShares.length > CAP) throw new FoundationError("UNAVAILABLE");
      const ownIds = new Set(ownShares.map(s => s.id));
      const state = actor.role === "AGENT" ? { lots: [], entries: [] } : await ledger(tx, organizationId, actor.role === "FARMER" ? [...ownIds] : undefined);
      const lots = actor.role === "FARMER" ? state.lots.filter(l => ownIds.has(l.shareId)) : state.lots;
      const lotIds = new Set(lots.map(l => l.id)), entries = state.entries.filter(e => lotIds.has(e.lotId));
      const report = organizationReport(lots, entries);
      result.inventory = report.inventory; result.inventoryAggregates = report.inventoryAggregates; result.payments = report.payments; result.forecastTotals = declaredForecasts(forecastRows);
      const members = actor.role === "MANAGER" ? await tx.cooperativeMember.findMany({ where: { organizationId }, orderBy: { id: "asc" }, take: CAP + 1 }) : [];
      if (members.length > CAP) throw new FoundationError("UNAVAILABLE");
      const all = { members: members.map(memberView), farms, forecasts: forecastRows, lots, entries };
      const rows = all[section];
      if (cursor && !rows.some(row => row.id === cursor)) throw new FoundationError("FORBIDDEN");
      const page = rows.filter(row => !cursor || row.id > cursor).slice(0, 51);
      result.nextCursor = page.length > 50 ? page[49].id : null;
      const visible = new Set(page.slice(0, 50).map(row => row.id));
      result.members = section === "members" ? all.members.filter(row => visible.has(row.id)) : [];
      result.farms = section === "farms" ? farms.filter(row => visible.has(row.id)) : [];
      result.forecasts = section === "forecasts" ? forecastRows.filter(row => visible.has(row.id)) : [];
      result.lots = section === "lots" ? lots.filter(row => visible.has(row.id)) : [];
      result.entries = section === "entries" ? entries.filter(row => visible.has(row.id)) : [];
      return result;
    }, { isolationLevel: "RepeatableRead", timeout: 15_000 }),
  };
}
