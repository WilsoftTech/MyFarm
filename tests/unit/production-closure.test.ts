import { expect, it } from "vitest";
import { assertProductionClosure } from "@/modules/enterprises-seasons/domain/closure";
import { closeProductionSchema } from "@/modules/enterprises-seasons/contracts/closure";

it("requires explicit confirmation, a positive version and no client ownership fields", () => {
  const valid = { requestId: crypto.randomUUID(), expectedVersion: 1, confirmed: true };
  expect(closeProductionSchema.safeParse(valid).success).toBe(true);
  for (const change of [{ confirmed: false }, { confirmed: undefined }, { expectedVersion: 0 }, { expectedVersion: 1.5 }, { tenantId: crypto.randomUUID() }]) expect(closeProductionSchema.safeParse({ ...valid, ...change }).success).toBe(false);
});
it("permits only a current active record with no outstanding active cycles", () => {
  expect(() => assertProductionClosure({ status: "ACTIVE", version: 1 }, 1)).not.toThrow();
  for (const [status, version, expected, active] of [["CLOSED", 2, 2, 0], ["ACTIVE", 2, 1, 0], ["ACTIVE", 1, 1, 1]] as const) expect(() => assertProductionClosure({ status, version }, expected, active)).toThrow("CONFLICT");
});
