import { z } from "zod";
import { idSchema as baseIdSchema } from "@/modules/engineering-foundation/contracts/identity";
import { isCalendarDate } from "@/modules/enterprises-seasons/domain/production";
import { normalizeCurrency, normalizePositiveAmount } from "@/modules/farm-accounting/domain/money";
import { normalizeHarvestQuantity, quantityUnits } from "@/modules/harvest-inventory/domain/harvest";

const name = z.string().trim().min(1).max(120);
// UUID casing must not split the advisory-lock or canonical receipt namespace.
export const cooperativeIdSchema = baseIdSchema.transform(value => value.toLowerCase());
const idSchema = cooperativeIdSchema;
const date = z.string().refine(isCalendarDate, "Use a valid date.");
const quantity = z.string().refine(v => normalizeHarvestQuantity(v) !== null && quantityUnits(v) > 0n, "Enter a positive quantity with up to six decimal places.");
const amount = z.string().refine(v => normalizePositiveAmount(v) !== null, "Enter a positive amount with up to four decimal places.").transform(v => normalizePositiveAmount(v)!);
const currency = z.string().refine(v => normalizeCurrency(v) !== null).transform(v => normalizeCurrency(v)!);
export const cooperativeRole = z.enum(["MANAGER", "FARMER", "AGENT", "BUYER"]);
export type CooperativeRole = z.infer<typeof cooperativeRole>;
const base = { requestId: idSchema, confirmed: z.literal(true) };
export const createCooperativeSchema = z.object({ ...base, organizationId: idSchema, name }).strict();
export const relationshipCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("INVITE"), userId: idSchema, role: cooperativeRole }).strict(),
  z.object({ ...base, type: z.literal("ACCEPT"), memberId: idSchema, expectedVersion: z.number().int().positive() }).strict(),
  z.object({ ...base, type: z.literal("REVOKE_MEMBER"), memberId: idSchema, expectedVersion: z.number().int().positive() }).strict(),
  z.object({ ...base, type: z.literal("SHARE"), farmId: idSchema, shareLocation: z.boolean(), shareProduction: z.boolean() }).strict(),
  z.object({ ...base, type: z.literal("REVOKE_SHARE"), shareId: idSchema, expectedVersion: z.number().int().positive() }).strict(),
]);
export const operationCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("FORECAST"), shareId: idSchema, product: name, unit: z.enum(["KG", "EGG", "BIRD"]), quantity, harvestFrom: date, harvestTo: date }).strict(),
  z.object({ ...base, type: z.literal("CANCEL_FORECAST"), forecastId: idSchema, expectedVersion: z.number().int().positive() }).strict(),
  z.object({ ...base, type: z.literal("PROCURE"), shareId: idSchema, harvestId: idSchema.nullable(), product: name, unit: z.enum(["KG", "EGG", "BIRD"]), quantity, unitPrice: amount, currency, grade: z.string().trim().max(80), location: name, occurredOn: date }).strict(),
  z.object({ ...base, type: z.literal("MOVE"), lotId: idSchema, quantity, from: name, to: name, occurredOn: date }).strict(),
  z.object({ ...base, type: z.literal("RELEASE"), lotId: idSchema, quantity, location: name, reason: z.string().trim().min(1).max(500), occurredOn: date }).strict(),
  z.object({ ...base, type: z.literal("PAYMENT"), lotId: idSchema, amount, currency, reference: z.string().trim().min(1).max(120), occurredOn: date }).strict(),
  z.object({ ...base, type: z.literal("REVERSE"), operationId: idSchema, reason: z.string().trim().min(1).max(500) }).strict(),
  z.object({ ...base, type: z.literal("PUBLISH"), lotId: idSchema, expectedVersion: z.number().int().positive(), published: z.boolean() }).strict(),
]);
export type CreateCooperative = z.infer<typeof createCooperativeSchema>;
export type RelationshipCommand = z.infer<typeof relationshipCommandSchema>;
export type OperationCommand = z.infer<typeof operationCommandSchema>;
export type CooperativeCommand = RelationshipCommand | OperationCommand;
export interface Receipt { targetId: string; version: number }
export const sectionSchema = z.enum(["members", "farms", "forecasts", "lots", "entries"]);
export type Section = z.infer<typeof sectionSchema>;
export interface MemberView { id: string; userId: string; role: CooperativeRole; status: string; version: number }
export interface SharedFarmView { id: string; farmId: string; farmerId: string; name: string; district: string; latitude: string | null; longitude: string | null; shareLocation: boolean; shareProduction: boolean; version: number }
export interface ForecastView { id: string; shareId: string; product: string; unit: string; quantity: string; harvestFrom: string; harvestTo: string; version: number }
export interface LotView { id: string; shareId: string; harvestId: string | null; product: string; unit: string; quantity: string; unitPrice: string; currency: string; total: string; grade: string; occurredOn: string; published: boolean; version: number }
export interface EntryView { id: string; operationId: string; lotId: string; product: string; unit: string; currency: string; kind: "STOCK" | "PAYMENT"; location: string; quantityDelta: string; amountDelta: string; occurredOn: string; reason: string; reversalOfId: string | null }
export interface InventoryTotal { lotId: string; product: string; unit: string; location: string; quantity: string }
export interface InventoryAggregate { product: string; unit: string; location: string; quantity: string }
export interface PaymentTotal { lotId: string; currency: string; obligation: string; paid: string; outstanding: string }
export interface ForecastTotal { product: string; unit: string; harvestFrom: string; harvestTo: string; quantity: string }
export interface CooperativeView {
  actorId: string; organizationId: string; name: string; role: CooperativeRole; asOf: string; section: Section; nextCursor: string | null;
  members: MemberView[]; farms: SharedFarmView[]; forecasts: ForecastView[]; lots: LotView[]; entries: EntryView[];
  inventory: InventoryTotal[]; inventoryAggregates: InventoryAggregate[]; payments: PaymentTotal[]; forecastTotals: ForecastTotal[];
  published: { product: string; unit: string; quantity: string }[];
}
export interface CooperativeRepository {
  list(actorId: string): Promise<{ id: string; name: string; member: MemberView }[]>;
  create(actorId: string, command: CreateCooperative): Promise<Receipt>;
  relationship(actorId: string, organizationId: string, command: RelationshipCommand): Promise<Receipt>;
  operation(actorId: string, organizationId: string, command: OperationCommand): Promise<Receipt>;
  read(actorId: string, organizationId: string, section: Section, cursor: string | null): Promise<CooperativeView>;
}
