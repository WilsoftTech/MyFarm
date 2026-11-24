import "server-only";
import type { Prisma, PrismaClient, CooperativeLot, CooperativeEntry } from "@/generated/prisma/client";
import { FoundationError } from "@/modules/engineering-foundation/domain/errors";
import { quantityUnits, quantityString } from "@/modules/harvest-inventory/domain/harvest";
import { signedQuantityString, signedQuantityUnits } from "@/modules/harvest-inventory/domain/stock";
import { moneyUnits, signedMoneyString } from "@/modules/farm-accounting/domain/money";
import { organizationReport, declaredForecasts, procurementTotal } from "../domain/operations";
import type { OperationCommand, LotView, EntryView, Receipt } from "../contracts/cooperative";
import { currentShare, member, mutate, type Tx } from "./access";

export const day = (d: Date) => d.toISOString().slice(0, 10);
export const lotView = (r: CooperativeLot): LotView => ({ id: r.id, shareId: r.shareId, harvestId: r.harvestId, product: r.product, unit: r.unit, quantity: r.quantity.toString(), unitPrice: r.unitPrice.toString(), currency: r.currency, total: r.total.toString(), grade: r.grade, occurredOn: day(r.occurredOn), published: r.published, version: r.version });
export function entryView(r: CooperativeEntry, lot: CooperativeLot): EntryView {
  if (r.kind !== "STOCK" && r.kind !== "PAYMENT") throw new FoundationError("UNAVAILABLE");
  return { id: r.id, operationId: r.operationId, lotId: r.lotId, product: lot.product, unit: lot.unit, currency: lot.currency, kind: r.kind, location: r.location, quantityDelta: r.quantityDelta.toString(), amountDelta: r.amountDelta.toString(), occurredOn: day(r.occurredOn), reason: r.reason, reversalOfId: r.reversalOfId };
}
const CAP = 10_000;
export async function ledger(tx: Tx, organizationId: string, shareIds?: string[]) {
  const lots = await tx.cooperativeLot.findMany({ where: { organizationId, ...(shareIds ? { shareId: { in: shareIds } } : {}) }, orderBy: { id: "asc" }, take: CAP + 1 });
  const entries = await tx.cooperativeEntry.findMany({ where: { organizationId, ...(shareIds ? { lotId: { in: lots.map(l => l.id) } } : {}) }, orderBy: { id: "asc" }, take: CAP + 1 });
  if (lots.length > CAP || entries.length > CAP) throw new FoundationError("UNAVAILABLE");
  const byId = new Map(lots.map(l => [l.id, l]));
  return { lots: lots.map(lotView), entries: entries.map(row => {
    const lot = byId.get(row.lotId); if (!lot) throw new FoundationError("UNAVAILABLE");
    return entryView(row, lot);
  }) };
}
export function operation(db: PrismaClient, actorId: string, organizationId: string, command: OperationCommand) {
  const authorize = async (tx: Tx) => {
    if (command.type === "FORECAST") {
      await member(tx, actorId, organizationId, ["FARMER"]);
      const { share } = await currentShare(tx, organizationId, command.shareId, true);
      if (share.grantedBy !== actorId) throw new FoundationError("FORBIDDEN");
    } else if (command.type === "CANCEL_FORECAST") {
      await member(tx, actorId, organizationId, ["FARMER"]);
      const row = await tx.cooperativeForecast.findFirst({ where: { id: command.forecastId, organizationId, createdBy: actorId } });
      if (!row) throw new FoundationError("FORBIDDEN");
      await currentShare(tx, organizationId, row.shareId, true);
    } else {
      await member(tx, actorId, organizationId, ["MANAGER"]);
      if (command.type === "PROCURE") await currentShare(tx, organizationId, command.shareId, true);
    }
  };
  return mutate(db, actorId, organizationId, command, command.type, authorize, async (tx): Promise<Receipt> => {
    if (command.type === "FORECAST") {
      declaredForecasts([{ id: "", shareId: command.shareId, product: command.product, unit: command.unit, quantity: command.quantity, harvestFrom: command.harvestFrom, harvestTo: command.harvestTo, version: 1 }]);
      const row = await tx.cooperativeForecast.create({ data: { organizationId, shareId: command.shareId, createdBy: actorId, product: command.product, unit: command.unit, quantity: command.quantity, harvestFrom: new Date(command.harvestFrom + "T00:00:00Z"), harvestTo: new Date(command.harvestTo + "T00:00:00Z") } });
      return { targetId: row.id, version: 1 };
    }
    if (command.type === "CANCEL_FORECAST") {
      const result = await tx.cooperativeForecast.updateMany({ where: { id: command.forecastId, organizationId, createdBy: actorId, cancelledAt: null, version: command.expectedVersion }, data: { cancelledAt: new Date(), version: { increment: 1 } } });
      if (result.count !== 1) throw new FoundationError("CONFLICT");
      return { targetId: command.forecastId, version: command.expectedVersion + 1 };
    }
    let operationId = crypto.randomUUID();
    const append = (data: Omit<Prisma.CooperativeEntryUncheckedCreateInput, "organizationId" | "operationId" | "createdBy">) => tx.cooperativeEntry.create({ data: { ...data, organizationId, operationId, createdBy: actorId } });
    if (command.type === "PROCURE") {
      const { share, farm } = await currentShare(tx, organizationId, command.shareId, true);
      if (command.harvestId) {
        const harvest = await tx.harvest.findFirst({ where: { id: command.harvestId, tenantId: share.tenantId, farmId: farm.id } });
        if (!harvest || harvest.unit !== command.unit || harvest.cropName !== command.product || day(harvest.harvestDate) > command.occurredOn) throw new FoundationError("FORBIDDEN");
        // This is provenance only, never a stock transfer or a custody claim.
      }
      const total = procurementTotal(command.quantity, command.unitPrice, command.unit);
      const lot = await tx.cooperativeLot.create({ data: { organizationId, shareId: share.id, harvestId: command.harvestId, createdBy: actorId, product: command.product, unit: command.unit, quantity: command.quantity, unitPrice: command.unitPrice, currency: command.currency, total, grade: command.grade, occurredOn: new Date(command.occurredOn + "T00:00:00Z") } });
      operationId = lot.id;
      await append({ lotId: lot.id, kind: "STOCK", location: command.location, quantityDelta: command.quantity, amountDelta: "0", occurredOn: lot.occurredOn, reason: "PROCUREMENT" });
      const state = await ledger(tx, organizationId); organizationReport(state.lots, state.entries);
      return { targetId: lot.id, version: lot.version };
    }
    if (command.type === "REVERSE") {
      const rows = await tx.cooperativeEntry.findMany({ where: { operationId: command.operationId, organizationId }, orderBy: { id: "asc" }, take: 3 });
      if (!rows.length || rows.length > 2 || rows.some(r => r.reversalOfId)) throw new FoundationError("FORBIDDEN");
      if (await tx.cooperativeEntry.findFirst({ where: { organizationId, reversalOfId: { in: rows.map(r => r.id) } } })) throw new FoundationError("CONFLICT");
      for (const row of rows) {
        const signedAmount = row.amountDelta.toString();
        const amountUnits = signedAmount.startsWith("-") ? -moneyUnits(signedAmount.slice(1)) : moneyUnits(signedAmount);
        await append({ lotId: row.lotId, kind: row.kind, location: row.location, quantityDelta: signedQuantityString(-signedQuantityUnits(row.quantityDelta.toString())), amountDelta: signedMoneyString(-amountUnits), occurredOn: row.occurredOn, reason: command.reason, reversalOfId: row.id });
      }
    } else {
      const lot = await tx.cooperativeLot.findFirst({ where: { id: command.lotId, organizationId } });
      if (!lot) throw new FoundationError("FORBIDDEN");
      if (command.type === "PUBLISH") {
        if (lot.version !== command.expectedVersion) throw new FoundationError("CONFLICT");
        await tx.cooperativeLot.update({ where: { id: lot.id }, data: { published: command.published, version: { increment: 1 } } });
        return { targetId: lot.id, version: lot.version + 1 };
      }
      const acquisition = await tx.cooperativeEntry.findFirst({ where: { lotId: lot.id, organizationId, operationId: lot.id, reversalOfId: null } });
      if (!acquisition || await tx.cooperativeEntry.findFirst({ where: { organizationId, reversalOfId: acquisition.id } })) throw new FoundationError("CONFLICT");
      if (command.occurredOn < day(lot.occurredOn)) throw new FoundationError("INVALID_INPUT");
      const occurredOn = new Date(command.occurredOn + "T00:00:00Z");
      if (command.type === "PAYMENT") {
        if (command.currency !== lot.currency) throw new FoundationError("INVALID_INPUT");
        await append({ lotId: lot.id, kind: "PAYMENT", location: "", quantityDelta: "0", amountDelta: command.amount, occurredOn, reason: command.reference });
      } else {
        const q = quantityUnits(command.quantity);
        if (lot.unit !== "KG" && q % 1_000_000n !== 0n) throw new FoundationError("INVALID_INPUT");
        const location = command.type === "MOVE" ? command.from : command.location;
        if (command.type === "MOVE" && command.from === command.to) throw new FoundationError("INVALID_INPUT");
        await append({ lotId: lot.id, kind: "STOCK", location, quantityDelta: "-" + quantityString(q), amountDelta: "0", occurredOn, reason: command.type === "MOVE" ? "TRANSFER" : command.reason });
        if (command.type === "MOVE") await append({ lotId: lot.id, kind: "STOCK", location: command.to, quantityDelta: quantityString(q), amountDelta: "0", occurredOn, reason: "TRANSFER" });
      }
    }
    const state = await ledger(tx, organizationId); organizationReport(state.lots, state.entries);
    return { targetId: operationId, version: 1 };
  });
}
