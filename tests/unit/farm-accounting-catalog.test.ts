import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { categoryReleaseSchema, paymentMethodReleaseSchema } from "@/modules/farm-accounting/contracts/accounting";
import { applyCategoryRelease, applyPaymentMethodRelease, categoryHistory, type CategoryEntry } from "@/modules/farm-accounting/domain/catalog";
import { assertAccountingRecord, type AccountingRecordFields } from "@/modules/farm-accounting/domain/accounting";

const id = () => crypto.randomUUID();
const invalid = expect.objectContaining({ code: "INVALID_INPUT" });
const conflict = expect.objectContaining({ code: "CONFLICT" });
// Source P0288–P0300, in source order, and the owner-approved revenue/payment entries (D-P04-005).
const SOURCE_COST = ["Seeds", "Feed", "Fertilizer", "Veterinary", "Labour", "Transport", "Fuel", "Equipment", "Rent", "Utilities", "Medication", "Pesticides", "Packaging"];
const APPROVED_REVENUE = ["Crop sales", "Livestock sales", "Egg sales", "Other income"];
const APPROVED_METHODS = ["Cash", "Mobile Money", "Bank transfer"];
// Read the real shipped SQL payload, so these checks verify the actual reviewed seed release.
const migration = readFileSync("prisma/migrations/202610250002_farm_accounting/migration.sql", "utf8");
const seeded = [...migration.matchAll(/\('([0-9a-f-]{36})', '(COST|REVENUE)', '([^']+)'\)/g)].map(([, seedId, kind, name]) => ({ id: seedId, kind: kind as "COST" | "REVENUE", name }));
const methods = [...migration.matchAll(/\('([0-9a-f-]{36})', '([^']+)'\)/g)].map(([, seedId, name]) => ({ id: seedId, name }));
const shipped = applyCategoryRelease([], categoryReleaseSchema.parse({ additions: seeded }));

describe("source categories are all available (P04-T004, AC002)", () => {
  it("ships exactly the 13 source cost categories in source order, all active", () => {
    expect(seeded.filter(entry => entry.kind === "COST").map(entry => entry.name)).toEqual(SOURCE_COST);
    expect(shipped.filter(entry => entry.kind === "COST").every(entry => entry.active)).toBe(true);
  });
  it("ships the approved revenue categories and payment methods", () => {
    expect(seeded.filter(entry => entry.kind === "REVENUE").map(entry => entry.name)).toEqual(APPROVED_REVENUE);
    expect(applyPaymentMethodRelease([], paymentMethodReleaseSchema.parse({ additions: methods })).map(entry => entry.name)).toEqual(APPROVED_METHODS);
  });
  it("lists the seeds first under the newest-first catalog order (descending IDs)", () => {
    for (const kind of ["COST", "REVENUE"] as const) {
      const ids = seeded.filter(entry => entry.kind === kind).map(entry => entry.id);
      expect(ids).toEqual([...ids].sort().reverse());
    }
  });
  it.each(SOURCE_COST)("allows a cost record in the source category %s", name => {
    const category = shipped.find(entry => entry.name === name)!;
    const fields: AccountingRecordFields = { kind: "EXPENSE", categoryId: category.id, amount: "1", currency: "UGX", occurredOn: "2027-03-10" };
    expect(() => assertAccountingRecord({ tenantId: id(), farmId: id() }, fields, { category: { categoryId: category.id, kind: category.kind, active: category.active } })).not.toThrow();
    expect(() => assertAccountingRecord({ tenantId: id(), farmId: id() }, { ...fields, kind: "SALE" }, { category: { categoryId: category.id, kind: category.kind, active: category.active } })).toThrow(invalid);
  });
});

describe("reviewed category releases (P04-T004, D-P04-005)", () => {
  it("adds categories per kind with new stable IDs and archives instead of deleting", () => {
    const added = { id: id(), kind: "COST" as const, name: "Irrigation" }, labour = shipped.find(entry => entry.name === "Labour")!;
    const after = applyCategoryRelease(shipped, { additions: [added], deactivations: [labour.id] });
    expect(after).toHaveLength(shipped.length + 1);
    expect(after.find(entry => entry.id === labour.id)).toEqual({ ...labour, active: false });
    expect(after.find(entry => entry.id === added.id)).toEqual({ ...added, active: true });
  });
  it("lets a cost and a revenue category share a name but never two of one kind, even archived", () => {
    expect(applyCategoryRelease(shipped, { additions: [{ id: id(), kind: "REVENUE", name: "Fertilizer" }], deactivations: [] })).toHaveLength(shipped.length + 1);
    for (const name of ["fertilizer", "FERTILIZER", "Fertilizer"]) {
      expect(() => applyCategoryRelease(shipped, { additions: [{ id: id(), kind: "COST", name }], deactivations: [] })).toThrow(conflict);
    }
    const archived = applyCategoryRelease(shipped, { additions: [], deactivations: [shipped.find(entry => entry.name === "Fertilizer")!.id] });
    expect(() => applyCategoryRelease(archived, { additions: [{ id: id(), kind: "COST", name: "Fertilizer" }], deactivations: [] })).toThrow(conflict);
  });
  it("rejects reused IDs (across kinds), unknown or repeated deactivations and unknown kinds", () => {
    const cost = shipped.find(entry => entry.kind === "COST")!;
    expect(() => applyCategoryRelease(shipped, { additions: [{ id: cost.id, kind: "REVENUE", name: "New" }], deactivations: [] })).toThrow(conflict);
    expect(() => applyCategoryRelease(shipped, { additions: [], deactivations: [id()] })).toThrow(invalid);
    expect(() => applyCategoryRelease(shipped, { additions: [], deactivations: [cost.id, cost.id] })).toThrow(invalid);
    const archived = applyCategoryRelease(shipped, { additions: [], deactivations: [cost.id] });
    expect(() => applyCategoryRelease(archived, { additions: [], deactivations: [cost.id] })).toThrow(invalid);
    expect(() => applyCategoryRelease(shipped, { additions: [{ id: id(), kind: "TAX" as "COST", name: "VAT" }], deactivations: [] })).toThrow(invalid);
  });
  it.each(["", " ", "x".repeat(121), " Feed2", "Feed  2"])("rejects an unnormalized or overlong name %j", name => {
    expect(() => applyCategoryRelease(shipped, { additions: [{ id: id(), kind: "COST", name }], deactivations: [] })).toThrow(invalid);
  });
  it("has no tenant, farm or ownership field: categories are global reviewed data", () => {
    for (const key of ["tenantId", "farmId", "ownerId", "createdBy"]) {
      expect(categoryReleaseSchema.safeParse({ additions: [{ id: id(), kind: "COST", name: "X", [key]: id() }] }).success).toBe(false);
      expect(categoryReleaseSchema.safeParse({ additions: [], [key]: id() }).success).toBe(false);
    }
    expect(categoryReleaseSchema.safeParse({ additions: [{ id: "not-a-uuid", kind: "COST", name: "X" }] }).success).toBe(false);
    expect(categoryReleaseSchema.parse({ additions: [] }).deactivations).toEqual([]);
  });
});

describe("archived categories stay readable in history (P04-T004, AC002)", () => {
  const fertilizer = shipped.find(entry => entry.name === "Fertilizer")!;
  const record = { categoryId: fertilizer.id, categoryName: "Fertilizer" };
  it("keeps the saved name and marks whether the category is still offered", () => {
    expect(categoryHistory(record, fertilizer)).toEqual({ categoryId: fertilizer.id, name: "Fertilizer", archived: false });
    expect(categoryHistory(record, { ...fertilizer, active: false })).toEqual({ categoryId: fertilizer.id, name: "Fertilizer", archived: true });
    expect(categoryHistory(record, null)).toEqual({ categoryId: fertilizer.id, name: "Fertilizer", archived: true });
  });
  it("never shows a later catalog name over the saved one, and refuses a mismatched lookup", () => {
    expect(categoryHistory(record, { ...fertilizer, name: "Fertiliser (renamed)" }).name).toBe("Fertilizer");
    expect(() => categoryHistory(record, { ...fertilizer, id: id() } as CategoryEntry)).toThrow(invalid);
  });
  it("refuses an archived category for new records (CONFLICT), but not for reading", () => {
    const fields: AccountingRecordFields = { kind: "PURCHASE", categoryId: fertilizer.id, amount: "150000", currency: "UGX", occurredOn: "2027-03-10" };
    expect(() => assertAccountingRecord({ tenantId: id(), farmId: id() }, fields, { category: { categoryId: fertilizer.id, kind: "COST", active: false } })).toThrow(conflict);
  });
});

describe("accounting code never branches on seeded catalog names or IDs (P04-T004)", () => {
  it("keeps category and payment-method names as data", () => {
    const files = readdirSync("src", { recursive: true, encoding: "utf8" }).filter(file => /\.(ts|tsx)$/.test(file) && !file.startsWith("generated"));
    expect(files.length).toBeGreaterThan(50);
    // "Other income" is also the plain label of the INCOME record kind, so it is not a catalog-branching signal.
    // Case-sensitive: enum values such as the CASH recognition basis are not catalog names.
    const names = [...SOURCE_COST, ...APPROVED_REVENUE.filter(name => name !== "Other income"), ...APPROVED_METHODS].join("|");
    const literal = new RegExp(`["'\`](${names})["'\`]`), seedId = /f4040002-/i;
    expect(files.filter(file => { const source = readFileSync(join("src", file), "utf8"); return literal.test(source) || seedId.test(source); })).toEqual([]);
  });
});
