import { expect, it } from "vitest";
import { productionEventSchema } from "@/modules/harvest-inventory/contracts/production";
import { reconstructFlock, type FlockEvent } from "@/modules/harvest-inventory/domain/production";
const base = { requestId: crypto.randomUUID(), batchId: crypto.randomUUID(), locationId: crypto.randomUUID(), type: "PURCHASE", quantity: "20", unit: "BIRD", occurredOn: "2026-10-01" };
const e = (type: FlockEvent["type"], quantity: string, unit = "BIRD"): FlockEvent => ({ type, quantity, unit, occurredOn: base.occurredOn });
it("reconstructs 100+20-5-10=105 without counting eggs/feed/medication as birds", () => {
  expect(reconstructFlock(100, [e("PURCHASE", "20"), e("MORTALITY", "5"), e("BIRD_SALE", "10"), e("EGGS", "50", "EGG"), e("FEED", "2.5", "KG"), e("MEDICATION", "2", "ML")])).toBe(105);
});
it.each(["1.5", "0", "-1", "1e2"])("rejects invalid bird counts %s", quantity => {
  expect(productionEventSchema.safeParse({ ...base, quantity }).success).toBe(false);
});
it("rejects excessive mortality and overflow", () => {
  expect(() => reconstructFlock(100, [e("MORTALITY", "101")])).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  expect(() => reconstructFlock(2_147_483_647, [e("PURCHASE", "1")])).toThrow();
});
it("validates distinct units and exact feed quantities", () => {
  expect(productionEventSchema.safeParse({ ...base, type: "EGGS", unit: "BIRD" }).success).toBe(false);
  expect(productionEventSchema.safeParse({ ...base, type: "FEED", quantity: "0.000001", unit: "KG" }).success).toBe(true);
  expect(productionEventSchema.safeParse({ ...base, type: "MEDICATION", unit: "BIRD" }).success).toBe(false);
});
it("requires accounting fields for bird sales only and rejects forged scope", () => {
  expect(productionEventSchema.safeParse({ ...base, type: "BIRD_SALE" }).success).toBe(false);
  expect(productionEventSchema.safeParse({ ...base, farmId: crypto.randomUUID() }).success).toBe(false);
});
