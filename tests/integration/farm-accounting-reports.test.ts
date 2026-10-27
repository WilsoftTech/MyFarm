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
import { FarmReportService } from "@/modules/farm-accounting/application/reporting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { farmReportRepository } from "@/modules/farm-accounting/infrastructure/report-repository";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Report tests require isolated loopback myfarm_phase01_test database.");
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
const id = () => crypto.randomUUID();
const users = { a: id(), b: id(), admin: id() }, subjects = { a: id(), b: id(), admin: id() };
const auth = (who: keyof typeof users) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime));
const registry = (who: keyof typeof users) => new FarmerRegistryService(auth(who), registryRepository(runtime));
const production = (who: keyof typeof users) => new ProductionService(auth(who), registryRepository(runtime), productionRepository(runtime));
const accounts = (who: keyof typeof users = "a") => new FarmAccountingService(auth(who), registryRepository(runtime), farmAccountingRepository(runtime));
const now = new Date("2027-12-31T09:00:00.000Z");
const reports = (who: keyof typeof users = "a") => new FarmReportService(auth(who), registryRepository(runtime), farmReportRepository(runtime), () => now);
const seed = { fertilizer: "f4040002-0000-4000-8000-000000000111", feed: "f4040002-0000-4000-8000-000000000112", rent: "f4040002-0000-4000-8000-000000000105", cropSales: "f4040002-0000-4000-8000-000000000204", eggSales: "f4040002-0000-4000-8000-000000000202", otherIncome: "f4040002-0000-4000-8000-000000000201", cash: "f4040002-0000-4000-8000-000000000303" };
let tenantA: string, tenantB: string, farm: string, empty: string, farmB: string, maize: string, layers: string, rent: string, eggSale: string;
const record = (kind: "EXPENSE" | "INCOME" | "SALE" | "PURCHASE", categoryId: string, amount: string, occurredOn: string, enterpriseId?: string, currency = "UGX") =>
  accounts().recordTransaction(kind, farm, { requestId: id(), categoryId, amount, currency, occurredOn, ...(enterpriseId ? { enterpriseId } : {}) });

beforeAll(async () => {
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  await owner.user.createMany({ data: (["a", "b", "admin"] as const).map(who => ({ id: users[who], authSubject: subjects[who] })) });
  const profile = (name: string) => ({ requestId: id(), name, phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] });
  tenantA = (await registry("a").register(profile("Reports A"))).tenantId; tenantB = (await registry("b").register(profile("Reports B"))).tenantId;
  const newFarm = (who: "a" | "b", name: string) => registry(who).createFarm({ requestId: id(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" });
  farm = (await newFarm("a", "Report farm")).farmId; empty = (await newFarm("a", "Empty farm")).farmId; farmB = (await newFarm("b", "Other tenant")).farmId;
  await owner.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
  await owner.farmMember.create({ data: { userId: users.admin, farmId: farm, tenantId: tenantA, role: "OWNER" } });
  maize = (await production("a").createEnterprise(farm, { requestId: id(), name: "Maize", type: "CROP" })).enterpriseId;
  layers = (await production("a").createEnterprise(farm, { requestId: id(), name: "=HYPERLINK(\"x\") layers", type: "POULTRY" })).enterpriseId;
  // AC004: Maize revenue 500,000 − direct costs 150,000 = 350,000 gross margin.
  const sale = await record("SALE", seed.cropSales, "500000", "2027-06-01", maize);
  await record("EXPENSE", seed.fertilizer, "150000", "2027-03-10", maize);
  await record("PURCHASE", seed.feed, "80000", "2027-04-01", layers);
  eggSale = (await record("SALE", seed.eggSales, "30000", "2027-05-01", layers)).recordId;
  rent = (await record("EXPENSE", seed.rent, "20000", "2027-02-01")).recordId;
  await record("INCOME", seed.otherIncome, "10", "2027-07-01", maize, "USD");
  await accounts().settle(farm, sale.recordId, { requestId: id(), amount: "200000", paidOn: "2027-06-10", paymentMethodId: seed.cash });
}, 60_000);
afterAll(async () => {
  const tenants = [tenantA, tenantB].filter(Boolean), actors = Object.values(users), where = { tenantId: { in: tenants } };
  try {
    await owner.accountingReversal.deleteMany({ where }); await owner.paymentAllocation.deleteMany({ where });
    await owner.paymentRecord.deleteMany({ where }); await owner.accountingRecord.deleteMany({ where });
    await owner.enterprise.deleteMany({ where });
    await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } });
    await owner.farmMember.deleteMany({ where: { userId: { in: actors } } }); await owner.farm.deleteMany({ where });
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } }); await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
    await owner.membership.deleteMany({ where: { userId: { in: actors } } }); await owner.organization.deleteMany({ where: { id: { in: tenants } } }); await owner.user.deleteMany({ where: { id: { in: actors } } });
  } finally { await Promise.all([owner.$disconnect(), runtime.$disconnect()]); }
});

describe("AC004 gross margin with the real restricted runtime role (P04-T011)", () => {
  it("computes 500,000 − 150,000 = 350,000 for maize, keeps currencies apart and labels the basis", async () => {
    const result = await reports().grossMargin(farm);
    expect(result).toMatchObject({ basis: "ACCRUAL", from: null, to: null, asOf: now.toISOString() });
    const ugx = result.currencies.find(c => c.currency === "UGX")!, usd = result.currencies.find(c => c.currency === "USD")!;
    expect(ugx.enterprises.find(e => e.enterpriseId === maize)).toEqual({ enterpriseId: maize, revenue: "500000", directCosts: "150000", grossMargin: "350000" });
    expect(ugx.enterprises.find(e => e.enterpriseId === layers)).toEqual({ enterpriseId: layers, revenue: "30000", directCosts: "80000", grossMargin: "-50000" });
    expect(ugx.farm).toEqual({ revenue: "530000", directCosts: "230000", grossMargin: "300000" });
    expect(ugx.unassigned).toEqual({ revenue: "0", costs: "20000" });
    expect(usd).toEqual({ currency: "USD", enterprises: [{ enterpriseId: maize, revenue: "10", directCosts: "0", grossMargin: "10" }], farm: { revenue: "10", directCosts: "0", grossMargin: "10" }, unassigned: { revenue: "0", costs: "0" } });
    expect(result.enterprises.map(e => e.name).sort()).toEqual(["=HYPERLINK(\"x\") layers", "Maize"].sort());
  });
  it("shows the cash view from money actually moved, and filters by inclusive dates", async () => {
    const cash = (await reports().grossMargin(farm, { basis: "CASH" })).currencies.find(c => c.currency === "UGX")!;
    expect(cash.enterprises.find(e => e.enterpriseId === maize)).toEqual({ enterpriseId: maize, revenue: "200000", directCosts: "150000", grossMargin: "50000" });
    expect(cash.enterprises.find(e => e.enterpriseId === layers)).toBeUndefined();
    const window = await reports().grossMargin(farm, { from: "2027-03-10", to: "2027-06-01" });
    expect(window).toMatchObject({ from: "2027-03-10", to: "2027-06-01" });
    expect(window.currencies.map(c => c.currency)).toEqual(["UGX"]);
    expect(window.currencies[0].unassigned.costs).toBe("0");
    expect(window.currencies[0].farm).toEqual({ revenue: "530000", directCosts: "230000", grossMargin: "300000" });
    expect((await reports().grossMargin(farm, { from: "2027-03-11", to: "2027-05-31" })).currencies[0].farm).toEqual({ revenue: "30000", directCosts: "80000", grossMargin: "-50000" });
    for (const input of [{ from: "2027-06-02", to: "2027-06-01" }, { from: "2027-02-30" }, { basis: "NET" }, { tenantId: tenantB }]) {
      await expect(reports().grossMargin(farm, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
  it("recomputes after a correction and is identical when repeated", async () => {
    const before = await reports().grossMargin(farm);
    expect(await reports().grossMargin(farm)).toEqual(before);
    await accounts().reverse(farm, { requestId: id(), recordType: "SALE", recordId: eggSale, reason: "Entered on the wrong farm" });
    try {
      const after = (await reports().grossMargin(farm)).currencies.find(c => c.currency === "UGX")!;
      expect(after.enterprises.find(e => e.enterpriseId === layers)).toMatchObject({ revenue: "0", grossMargin: "-80000" });
      expect(after.farm).toEqual({ revenue: "500000", directCosts: "230000", grossMargin: "270000" });
    } finally {
      await owner.accountingReversal.deleteMany({ where: { recordId: eggSale } });
      await owner.accountingRecord.update({ where: { id: eggSale }, data: { status: "POSTED", version: 1 } });
    }
  });
});

describe("AC005 money summary (P04-T014)", () => {
  it("answers spending, categories, revenue and the costliest enterprise per currency", async () => {
    const result = await reports().summary(farm);
    const ugx = result.currencies.find(c => c.currency === "UGX")!;
    expect(ugx).toEqual({ currency: "UGX", spent: "250000", revenue: "530000", unassignedCosts: "20000",
      spending: [{ categoryId: seed.fertilizer, categoryName: "Fertilizer", amount: "150000" }, { categoryId: seed.feed, categoryName: "Feed", amount: "80000" }, { categoryId: seed.rent, categoryName: "Rent", amount: "20000" }],
      costliest: { enterpriseIds: [maize], costs: "150000" } });
    expect(result.currencies.find(c => c.currency === "USD")).toMatchObject({ spent: "0", revenue: "10", costliest: { enterpriseIds: [] } });
    expect(result).toMatchObject({ basis: "ACCRUAL", asOf: now.toISOString() });
  });
  it("shows every enterprise tied for the highest costs", async () => {
    const extra = await record("PURCHASE", seed.feed, "70000", "2027-04-02", layers);
    try {
      const ugx = (await reports().summary(farm)).currencies.find(c => c.currency === "UGX")!;
      expect(ugx.costliest).toEqual({ enterpriseIds: [layers, maize].sort(), costs: "150000" });
    } finally { await accounts().reverse(farm, { requestId: id(), recordType: "PURCHASE", recordId: extra.recordId, reason: "Test tie" }); }
    expect((await reports().summary(farm)).currencies.find(c => c.currency === "UGX")!.costliest.enterpriseIds).toEqual([maize]);
  });
  it("is empty for a farm with no records and refreshes after a correction", async () => {
    expect(await reports().summary(empty)).toMatchObject({ currencies: [], enterprises: [] });
    expect(await reports().grossMargin(empty)).toMatchObject({ currencies: [] });
    await accounts().reverse(farm, { requestId: id(), recordType: "EXPENSE", recordId: rent, reason: "Paid by the landlord" });
    try {
      const ugx = (await reports().summary(farm)).currencies.find(c => c.currency === "UGX")!;
      expect(ugx).toMatchObject({ spent: "230000", unassignedCosts: "0" }); expect(ugx.spending.map(c => c.categoryName)).toEqual(["Fertilizer", "Feed"]);
    } finally {
      await owner.accountingReversal.deleteMany({ where: { recordId: rent } });
      await owner.accountingRecord.update({ where: { id: rent }, data: { status: "POSTED", version: 1 } });
    }
  });
});

describe("summary export and access (P04-T014, D-P04-009)", () => {
  it("exports an audited CSV for an active farm member, neutralizing formula-like text", async () => {
    const before = await owner.auditEvent.count({ where: { action: "ACCOUNTING_SUMMARY_EXPORTED", targetId: farm } });
    const { filename, csv } = await reports().exportSummary(farm, { from: "2027-01-01", to: "2027-12-31" });
    expect(filename).toBe("myfarm-money-summary-accrual-2027-01-01_2027-12-31.csv");
    expect(csv).toContain("Basis,Accrual (when sold or bought)\r\n");
    expect(csv).toContain("Money spent,UGX,All spending,250000\r\n");
    expect(csv).toContain("Gross margin,UGX,Maize,350000\r\n");
    expect(csv).toContain("Gross margin,UGX,\"'=HYPERLINK(\"\"x\"\") layers\",-50000\r\n");
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(await owner.auditEvent.count({ where: { action: "ACCOUNTING_SUMMARY_EXPORTED", targetId: farm, actorId: users.a, tenantId: tenantA } })).toBe(before + 1);
  });
  it("denies other tenants, admins, revoked members and bad input before any export audit", async () => {
    const count = () => owner.auditEvent.count({ where: { action: "ACCOUNTING_SUMMARY_EXPORTED", targetId: farm } });
    const before = await count();
    for (const who of ["b", "admin"] as const) {
      for (const call of [() => reports(who).exportSummary(farm), () => reports(who).summary(farm), () => reports(who).grossMargin(farm)]) await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(reports().summary(farmB)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reports().exportSummary(farm, { to: "not-a-date" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await owner.farmMember.updateMany({ where: { farmId: farm, userId: users.a }, data: { status: "REVOKED" } });
    try { await expect(reports().exportSummary(farm)).rejects.toMatchObject({ code: "FORBIDDEN" }); }
    finally { await owner.farmMember.updateMany({ where: { farmId: farm, userId: users.a }, data: { status: "ACTIVE" } }); }
    expect(await count()).toBe(before);
  });
});
