import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuthorizationService } from "@/modules/engineering-foundation/application/authorization";
import { identityRepository } from "@/modules/engineering-foundation/infrastructure/repository";
import { FarmerRegistryService } from "@/modules/farmer-registry/application/registry";
import { registryRepository } from "@/modules/farmer-registry/infrastructure/repository";
import { ProductionService } from "@/modules/enterprises-seasons/application/production";
import { productionRepository } from "@/modules/enterprises-seasons/infrastructure/repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Accounting tests require isolated loopback myfarm_phase01_test database.");
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
const id = () => crypto.randomUUID();
const users = { a: id(), b: id(), admin: id() }, subjects = { a: id(), b: id(), admin: id() };
const auth = (who: keyof typeof users) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime));
const registry = (who: keyof typeof users) => new FarmerRegistryService(auth(who), registryRepository(runtime));
const production = (who: keyof typeof users) => new ProductionService(auth(who), registryRepository(runtime), productionRepository(runtime));
const service = (who: keyof typeof users = "a") => new FarmAccountingService(auth(who), registryRepository(runtime), farmAccountingRepository(runtime));
// Approved seeds (D-P04-005).
const fertilizer = "f4040002-0000-4000-8000-000000000111", cropSales = "f4040002-0000-4000-8000-000000000204", mobileMoney = "f4040002-0000-4000-8000-000000000302", cash = "f4040002-0000-4000-8000-000000000303";
const categoryFixture = id();
let tenantA: string, tenantB: string, farmA: string, farmA2: string, farmB: string;
const sale = (overrides: Record<string, unknown> = {}) => ({ requestId: id(), categoryId: cropSales, amount: "200000", currency: "UGX", occurredOn: "2027-06-01", counterparty: "Market buyer", ...overrides });
const received = (obligationId: string, amount: string, overrides: Record<string, unknown> = {}) => ({ requestId: id(), direction: "RECEIVED", amount, currency: "UGX", paidOn: "2027-06-05", paymentMethodId: mobileMoney, allocations: [{ obligationId, amount }], ...overrides });
const receipts = (requestId: string) => owner.auditEvent.count({ where: { requestId } });

beforeAll(async () => {
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  await owner.user.createMany({ data: (["a", "b", "admin"] as const).map(who => ({ id: users[who], authSubject: subjects[who] })) });
  const profile = (name: string) => ({ requestId: id(), name, phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] });
  tenantA = (await registry("a").register(profile("Accounts A"))).tenantId; tenantB = (await registry("b").register(profile("Accounts B"))).tenantId;
  const farm = (name: string) => ({ requestId: id(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" });
  farmA = (await registry("a").createFarm(farm("A"))).farmId; farmA2 = (await registry("a").createFarm(farm("A2"))).farmId; farmB = (await registry("b").createFarm(farm("B"))).farmId;
  await owner.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
  await owner.farmMember.create({ data: { userId: users.admin, farmId: farmA, tenantId: tenantA, role: "OWNER" } });
  await owner.transactionCategory.create({ data: { id: categoryFixture, kind: "COST", name: "Synthetic cost " + categoryFixture } });
}, 30_000);
afterAll(async () => {
  const tenants = [tenantA, tenantB].filter(Boolean), actors = Object.values(users), where = { tenantId: { in: tenants } };
  try {
    await owner.accountingReversal.deleteMany({ where }); await owner.paymentAllocation.deleteMany({ where });
    await owner.paymentRecord.deleteMany({ where }); await owner.accountingRecord.deleteMany({ where });
    await owner.transactionCategory.deleteMany({ where: { id: categoryFixture } });
    await owner.enterprise.deleteMany({ where }); await owner.season.deleteMany({ where }); await owner.plot.deleteMany({ where });
    await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } });
    await owner.farmMember.deleteMany({ where: { userId: { in: actors } } }); await owner.farm.deleteMany({ where });
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } }); await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
    await owner.membership.deleteMany({ where: { userId: { in: actors } } }); await owner.organization.deleteMany({ where: { id: { in: tenants } } }); await owner.user.deleteMany({ where: { id: { in: actors } } });
  } finally { await Promise.all([owner.$disconnect(), runtime.$disconnect()]); }
});

describe("AC001 with the real restricted runtime role (P04-T002)", () => {
  it("records one sale, settles it partially and derives UGX 120,000 due with atomic receipts", async () => {
    const command = sale(), row = await service().recordTransaction("SALE", farmA, command);
    expect(await runtime.$queryRaw`SELECT current_user AS role`).toEqual([{ role: "myfarm_runtime" }]);
    expect(row).toMatchObject({ kind: "SALE", categoryName: "Crop sales", amount: "200000", currency: "UGX", status: "POSTED", version: 1, createdBy: users.a, balance: { outstanding: "200000", settlement: "OPEN" } });
    const pay = received(row.recordId, "80000");
    expect(await service().recordPayment(farmA, pay)).toMatchObject({ amount: "80000", status: "POSTED", allocations: [{ obligationId: row.recordId, amount: "80000" }] });
    expect((await service().record(farmA, row.recordId)).balance).toEqual({ obligationId: row.recordId, amount: "200000", currency: "UGX", settled: "80000", outstanding: "120000", settlement: "PARTIALLY_SETTLED" });
    expect(await owner.accountingRecord.count({ where: { farmId: farmA, id: row.recordId } })).toBe(1);
    expect(await owner.auditEvent.findMany({ where: { requestId: { in: [command.requestId, pay.requestId] } }, orderBy: { action: "asc" } })).toEqual([
      expect.objectContaining({ action: "ACCOUNTING_PAYMENT_RECORDED", actorId: users.a, tenantId: tenantA }),
      expect.objectContaining({ action: "ACCOUNTING_SALE_RECORDED", targetId: row.recordId, actorId: users.a, tenantId: tenantA }),
    ]);
    expect(await service().recordPayment(farmA, received(row.recordId, "120000"))).toMatchObject({ status: "POSTED" });
    expect((await service().record(farmA, row.recordId)).balance).toMatchObject({ outstanding: "0", settlement: "SETTLED" });
    const over = received(row.recordId, "1");
    await expect(service().recordPayment(farmA, over)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await receipts(over.requestId)).toBe(0);
  });
  it("lets only one of two concurrent payments take the last UGX 150,000", async () => {
    const row = await service().recordTransaction("SALE", farmA, sale());
    const results = await Promise.allSettled([service().recordPayment(farmA, received(row.recordId, "150000")), service().recordPayment(farmA, received(row.recordId, "150000"))]);
    expect(results.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(results.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "CONFLICT" } });
    expect((await service().record(farmA, row.recordId)).balance).toMatchObject({ settled: "150000", outstanding: "50000" });
  });
});

describe("record persistence (P04-T002)", () => {
  it("round-trips exact decimals, catalog snapshots, links and the payment method", async () => {
    const enterprise = await production("a").createEnterprise(farmA, { requestId: id(), name: "Maize " + id(), type: "CROP" });
    const season = await production("a").createSeason(farmA, { requestId: id(), label: "2027A " + id(), startDate: "2027-03-01" });
    const plot = await registry("a").createPlot(farmA, { requestId: id(), name: "Plot " + id() });
    const row = await service().recordTransaction("EXPENSE", farmA, { requestId: id(), categoryId: fertilizer, amount: "0150000.00", currency: "ugx", occurredOn: "2027-03-10", counterparty: " ABC  Agro ", paymentMethodId: mobileMoney, enterpriseId: enterprise.enterpriseId, seasonId: season.seasonId, plotId: plot.plotId });
    expect(row).toMatchObject({ kind: "EXPENSE", categoryName: "Fertilizer", amount: "150000", currency: "UGX", counterparty: "ABC Agro", paymentMethodId: mobileMoney, enterpriseId: enterprise.enterpriseId, seasonId: season.seasonId, plotId: plot.plotId, balance: null });
    expect(String((await owner.accountingRecord.findUniqueOrThrow({ where: { id: row.recordId } })).amount)).toBe("150000");
    for (const amount of ["0.0001", "9999999999999999.9999", "1234.5678"]) {
      expect((await service().recordTransaction("INCOME", farmA, sale({ amount, currency: "USD" }))).amount).toBe(amount);
    }
    expect(await service().record(farmA, row.recordId)).toEqual(row);
  });
  it("lists the approved catalogs in order and hides inactive entries", async () => {
    expect((await service().categories(farmA, { kind: "REVENUE" })).items.map(c => c.name)).toEqual(["Crop sales", "Livestock sales", "Egg sales", "Other income"]);
    await owner.transactionCategory.update({ where: { id: categoryFixture }, data: { active: false } });
    try {
      expect((await service().categories(farmA, { kind: "COST" })).items.map(c => c.name)).toEqual(["Seeds", "Feed", "Fertilizer", "Veterinary", "Labour", "Transport", "Fuel", "Equipment", "Rent", "Utilities", "Medication", "Pesticides", "Packaging"]);
    } finally { await owner.transactionCategory.update({ where: { id: categoryFixture }, data: { active: true } }); }
    expect((await service().categories(farmA, { kind: "COST" })).items.map(c => c.categoryId)).toContain(categoryFixture);
    expect((await service().paymentMethods(farmA)).items.map(m => m.name)).toEqual(["Cash", "Mobile Money", "Bank transfer"]);
    const first = await service().categories(farmA, { limit: 1 });
    expect((await service().categories(farmA, { limit: 1, cursor: first.nextCursor })).items[0].categoryId).not.toBe(first.items[0].categoryId);
    await expect(service().categories(farmA, { cursor: id() })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("replays identical retries once and conflicts on changed commands or another farm", async () => {
    const command = sale(), first = await service().recordTransaction("SALE", farmA, command);
    expect(await service().recordTransaction("SALE", farmA, { ...command, amount: "0200000.0" })).toEqual(first);
    for (const change of [{ amount: "200001" }, { counterparty: "Someone else" }, { occurredOn: "2027-06-02" }]) {
      await expect(service().recordTransaction("SALE", farmA, { ...command, ...change })).rejects.toMatchObject({ code: "CONFLICT" });
    }
    await expect(service().recordTransaction("SALE", farmA2, command)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.accountingRecord.count({ where: { tenantId: tenantA, counterparty: "Market buyer", id: first.recordId } })).toBe(1);
    expect(await receipts(command.requestId)).toBe(1);
    const pay = received(first.recordId, "1000"), paid = await service().recordPayment(farmA, pay);
    expect(await service().recordPayment(farmA, pay)).toEqual(paid);
    await expect(service().recordPayment(farmA, { ...pay, amount: "2000", allocations: [{ obligationId: first.recordId, amount: "2000" }] })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await owner.paymentRecord.count({ where: { id: paid.paymentId } })).toBe(1);
  });
  it("rejects wrong-kind, archived or unknown catalog entries and foreign links without receipts", async () => {
    const foreignEnterprise = await production("b").createEnterprise(farmB, { requestId: id(), name: "B maize", type: "CROP" });
    const siblingSeason = await production("a").createSeason(farmA2, { requestId: id(), label: "A2 season " + id(), startDate: "2027-03-01" });
    const cases: [string, Record<string, unknown>, string][] = [
      ["INVALID_INPUT", { categoryId: fertilizer }, "SALE"],
      ["INVALID_INPUT", { categoryId: id() }, "SALE"],
      ["INVALID_INPUT", { categoryId: fertilizer, paymentMethodId: id() }, "EXPENSE"],
      ["FORBIDDEN", { enterpriseId: foreignEnterprise.enterpriseId }, "SALE"],
      ["FORBIDDEN", { seasonId: siblingSeason.seasonId }, "SALE"],
      ["FORBIDDEN", { plotId: id() }, "SALE"],
    ];
    for (const [code, change, kind] of cases) {
      const bad = sale(change);
      await expect(service().recordTransaction(kind as "SALE", farmA, bad)).rejects.toMatchObject({ code });
      expect(await receipts(bad.requestId)).toBe(0);
    }
    await owner.transactionCategory.update({ where: { id: categoryFixture }, data: { active: false } });
    try {
      const bad = sale({ categoryId: categoryFixture, paymentMethodId: cash });
      await expect(service().recordTransaction("EXPENSE", farmA, bad)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await receipts(bad.requestId)).toBe(0);
    } finally { await owner.transactionCategory.update({ where: { id: categoryFixture }, data: { active: true } }); }
  });
});

describe("payment rules in the database transaction (P04-T002)", () => {
  it.each([
    ["money received against a purchase", "PURCHASE", { direction: "RECEIVED" }, "INVALID_INPUT"],
    ["a different currency", "SALE", { currency: "USD" }, "INVALID_INPUT"],
    ["a payment dated before the record", "SALE", { paidOn: "2027-05-31" }, "INVALID_INPUT"],
  ] as const)("rejects %s", async (_, kind, change, code) => {
    const row = await service().recordTransaction(kind, farmA, sale({ categoryId: kind === "SALE" ? cropSales : fertilizer }));
    const bad = received(row.recordId, "1000", change);
    await expect(service().recordPayment(farmA, bad)).rejects.toMatchObject({ code });
    expect(await receipts(bad.requestId)).toBe(0);
  });
  it("rejects settling an expense, another farm's sale or an unknown record", async () => {
    const expense = await service().recordTransaction("EXPENSE", farmA, sale({ categoryId: fertilizer }));
    const sibling = await service().recordTransaction("SALE", farmA2, sale());
    await expect(service().recordPayment(farmA, received(expense.recordId, "1"))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(service().recordPayment(farmA, received(sibling.recordId, "1"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service().recordPayment(farmA, received(id(), "1"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("reversal (P04-T002)", () => {
  it("reverses payments before the sale, restores the balance and never twice", async () => {
    const row = await service().recordTransaction("SALE", farmA, sale()), pay = await service().recordPayment(farmA, received(row.recordId, "80000"));
    await expect(service().reverse(farmA, { requestId: id(), recordType: "SALE", recordId: row.recordId, reason: "Wrong buyer" })).rejects.toMatchObject({ code: "CONFLICT" });
    const command = { requestId: id(), recordType: "PAYMENT", recordId: pay.paymentId, reason: " Entered twice " };
    const reversal = await service().reverse(farmA, command);
    expect(reversal).toMatchObject({ recordType: "PAYMENT", recordId: pay.paymentId, reversal: { reason: "Entered twice", reversedBy: users.a } });
    expect(await service().reverse(farmA, command)).toEqual(reversal);
    expect(await service().payment(farmA, pay.paymentId)).toMatchObject({ status: "REVERSED", version: 2, reversal: { reason: "Entered twice" } });
    expect((await service().record(farmA, row.recordId)).balance).toMatchObject({ settled: "0", outstanding: "200000", settlement: "OPEN" });
    await expect(service().reverse(farmA, { ...command, requestId: id() })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service().recordPayment(farmA, received(row.recordId, "1"))).resolves.toMatchObject({ status: "POSTED" });
  });
  it("voids a sale once under concurrent reversal and keeps the original amount readable", async () => {
    const row = await service().recordTransaction("SALE", farmA, sale());
    const reverse = () => service().reverse(farmA, { requestId: id(), recordType: "SALE", recordId: row.recordId, reason: "Cancelled order" });
    const results = await Promise.allSettled([reverse(), reverse()]);
    expect(results.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(await service().record(farmA, row.recordId)).toMatchObject({ amount: "200000", status: "REVERSED", version: 2, balance: { outstanding: "0", settlement: "VOID" }, reversal: { reason: "Cancelled order" } });
    expect(await owner.accountingReversal.count({ where: { recordId: row.recordId } })).toBe(1);
    await expect(service().recordPayment(farmA, received(row.recordId, "1"))).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("rejects a mismatched record type, another farm's record and a changed retry", async () => {
    const row = await service().recordTransaction("SALE", farmA, sale()), sibling = await service().recordTransaction("SALE", farmA2, sale());
    await expect(service().reverse(farmA, { requestId: id(), recordType: "PURCHASE", recordId: row.recordId, reason: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service().reverse(farmA, { requestId: id(), recordType: "SALE", recordId: sibling.recordId, reason: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const command = { requestId: id(), recordType: "SALE", recordId: row.recordId, reason: "Duplicate" };
    await service().reverse(farmA, command);
    await expect(service().reverse(farmA, { ...command, reason: "Other reason" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("runtime role and tenant isolation (P04-T002)", () => {
  it("cannot edit or delete posted history, or reverse without a reversal row", async () => {
    const row = await service().recordTransaction("SALE", farmA, sale());
    await expect(runtime.$executeRaw`UPDATE "AccountingRecord" SET amount = 1 WHERE id = ${row.recordId}::uuid`).rejects.toThrow(/permission denied/);
    await expect(runtime.$executeRaw`DELETE FROM "AccountingRecord" WHERE id = ${row.recordId}::uuid`).rejects.toThrow(/permission denied/);
    await expect(runtime.$executeRaw`UPDATE "AccountingRecord" SET status = 'REVERSED' WHERE id = ${row.recordId}::uuid`).rejects.toThrow(/row-level security/);
    await expect(runtime.$executeRaw`INSERT INTO "TransactionCategory" (id, kind, name) VALUES (${id()}::uuid, 'COST', 'Forbidden')`).rejects.toThrow(/permission denied/);
    expect((await service().record(farmA, row.recordId)).status).toBe("POSTED");
  });
  it("separates same-tenant farms, other tenants, admins, nested IDs and cursors", async () => {
    const row = await service().recordTransaction("SALE", farmA, sale());
    await expect(service().record(farmA2, row.recordId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service().records(farmA2, { cursor: row.recordId })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await service().records(farmA2)).items.every(r => r.farmId === farmA2)).toBe(true);
    for (const who of ["b", "admin"] as const) {
      for (const call of [() => service(who).recordTransaction("SALE", farmA, sale()), () => service(who).record(farmA, row.recordId), () => service(who).records(farmA), () => service(who).categories(farmA), () => service(who).recordPayment(farmA, received(row.recordId, "1")), () => service(who).reverse(farmA, { requestId: id(), recordType: "SALE", recordId: row.recordId, reason: "x" })]) {
        await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect((await service().record(farmA, row.recordId)).status).toBe("POSTED");
  });
  it("paginates tied creation times without omissions or duplicates", async () => {
    for (let n = 0; n < 5; n++) await service().recordTransaction("SALE", farmA2, sale());
    await owner.accountingRecord.updateMany({ where: { farmId: farmA2 }, data: { createdAt: new Date("2026-10-25T00:00:00Z") } });
    const seen: string[] = []; let cursor: string | undefined;
    do { const page = await service().records(farmA2, { limit: 2, cursor }); seen.push(...page.items.map(r => r.recordId)); cursor = page.nextCursor ?? undefined; } while (cursor);
    expect(new Set(seen).size).toBe(seen.length); expect(seen.length).toBe(await owner.accountingRecord.count({ where: { farmId: farmA2 } }));
  });
});
