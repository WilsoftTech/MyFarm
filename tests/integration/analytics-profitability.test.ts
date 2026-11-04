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
import { CropCycleService } from "@/modules/enterprises-seasons/application/crop-cycle";
import { cropCycleRepository } from "@/modules/enterprises-seasons/infrastructure/crop-cycle-repository";
import { FarmAccountingService } from "@/modules/farm-accounting/application/accounting";
import { FarmReportService } from "@/modules/farm-accounting/application/reporting";
import { farmAccountingRepository } from "@/modules/farm-accounting/infrastructure/repository";
import { farmReportRepository } from "@/modules/farm-accounting/infrastructure/report-repository";
import { FarmProfitabilityService } from "@/modules/analytics-profitability/application/profitability";
import { metricFactsRepository } from "@/modules/analytics-profitability/infrastructure/metric-facts-repository";
import { dashboardSeasonRepository } from "@/modules/analytics-profitability/infrastructure/repository";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Dashboard tests require isolated loopback myfarm_phase01_test database.");
const owner = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 4 }) });
const runtime = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 8, options: "-c role=myfarm_runtime" }) });
const id = () => crypto.randomUUID();
const users = { a: id(), b: id(), admin: id(), revoked: id() }, subjects = { a: id(), b: id(), admin: id(), revoked: id() };
type Who = keyof typeof users;
const auth = (who: Who) => new AuthorizationService({ currentIdentity: async () => ({ authSubject: subjects[who] }) }, identityRepository(runtime));
const registry = (who: Who) => new FarmerRegistryService(auth(who), registryRepository(runtime));
const production = (who: Who) => new ProductionService(auth(who), registryRepository(runtime), productionRepository(runtime));
const cycles = (who: Who) => new CropCycleService(auth(who), registryRepository(runtime), cropCycleRepository(runtime));
const accounts = (who: Who = "a") => new FarmAccountingService(auth(who), registryRepository(runtime), farmAccountingRepository(runtime));
const now = new Date("2027-12-31T09:00:00.000Z");
const reports = (who: Who = "a") => new FarmReportService(auth(who), registryRepository(runtime), farmReportRepository(runtime), () => now);
const dashboards = (who: Who = "a") => new FarmProfitabilityService(auth(who), registryRepository(runtime), farmReportRepository(runtime), dashboardSeasonRepository(runtime), metricFactsRepository(runtime), () => now);
const maizeCrop = "f4030005-0000-4000-8000-000000000001";
const seed = { feed: "f4040002-0000-4000-8000-000000000112", fertilizer: "f4040002-0000-4000-8000-000000000111", rent: "f4040002-0000-4000-8000-000000000105", cropSales: "f4040002-0000-4000-8000-000000000204", eggSales: "f4040002-0000-4000-8000-000000000202", otherIncome: "f4040002-0000-4000-8000-000000000201" };
let tenantA: string, tenantB: string, farm: string, empty: string, farmB: string, maize: string, bananas: string, poultry: string, season: string, otherSeason: string, closedSeason: string, foreignSeason: string, plot: string;
const record = (kind: "EXPENSE" | "INCOME" | "SALE" | "PURCHASE", categoryId: string, amount: string, occurredOn: string, links: { enterpriseId?: string; seasonId?: string; plotId?: string } = {}, currency = "UGX") =>
  accounts().recordTransaction(kind, farm, { requestId: id(), categoryId, amount, currency, occurredOn, ...links });

beforeAll(async () => {
  const pg = new Client({ connectionString: url }); await pg.connect();
  try { await runSqlFile(pg, supabaseEmulation); await applyProviderSql(pg); } finally { await pg.end(); }
  await owner.user.createMany({ data: (["a", "b", "admin", "revoked"] as const).map(who => ({ id: users[who], authSubject: subjects[who] })) });
  const profile = (name: string) => ({ requestId: id(), name, phone: "0772123456", district: "Rukungiri", preferredLanguage: "en", ownershipType: "OWNED", mainActivities: ["CROPS"] });
  tenantA = (await registry("a").register(profile("Dashboard A"))).tenantId; tenantB = (await registry("b").register(profile("Dashboard B"))).tenantId;
  const newFarm = (who: "a" | "b", name: string) => registry(who).createFarm({ requestId: id(), name, district: "Rukungiri", ownershipType: "OWNED", primaryActivity: "CROPS" });
  farm = (await newFarm("a", "Dashboard farm")).farmId; empty = (await newFarm("a", "Empty farm")).farmId; farmB = (await newFarm("b", "Other tenant")).farmId;
  await owner.membership.create({ data: { userId: users.admin, organizationId: tenantA, role: "ADMIN" } });
  await owner.farmMember.create({ data: { userId: users.admin, farmId: farm, tenantId: tenantA, role: "OWNER" } });
  await owner.membership.create({ data: { userId: users.revoked, organizationId: tenantA, role: "FARMER" } });
  await owner.farmMember.create({ data: { userId: users.revoked, farmId: farm, tenantId: tenantA, role: "OWNER", status: "REVOKED" } });
  season = (await production("a").createSeason(farm, { requestId: id(), label: "2027A", startDate: "2027-03-01" })).seasonId;
  otherSeason = (await production("a").createSeason(farm, { requestId: id(), label: "2026B", startDate: "2026-08-01" })).seasonId;
  closedSeason = (await production("a").createSeason(farm, { requestId: id(), label: "2027B", startDate: "2027-09-01" })).seasonId;
  await owner.season.update({ where: { id: closedSeason }, data: { status: "CLOSED" } });
  foreignSeason = (await production("b").createSeason(farmB, { requestId: id(), label: "Foreign", startDate: "2028-01-01" })).seasonId;
  plot = (await registry("a").createPlot(farm, { requestId: id(), name: "Hill", area: "10", areaUnit: "ACRE" })).plotId;
  maize = (await production("a").createEnterprise(farm, { requestId: id(), name: "Maize", type: "CROP" })).enterpriseId;
  bananas = (await production("a").createEnterprise(farm, { requestId: id(), name: "Bananas", type: "CROP" })).enterpriseId;
  poultry = (await production("a").createEnterprise(farm, { requestId: id(), name: "Poultry", type: "POULTRY" })).enterpriseId;
  for (const enterpriseId of [maize, bananas]) await cycles("a").start(farm, { requestId: id(), enterpriseId, seasonId: season, plotId: plot, cropId: maizeCrop, areaPlanted: "1", areaUnit: "ACRE", plantingDate: "2027-03-02" });
  // The source dashboard (P0494-P0513), linked to the season.
  await record("SALE", seed.cropSales, "3800000", "2027-06-01", { enterpriseId: maize, seasonId: season });
  await record("EXPENSE", seed.fertilizer, "2100000", "2027-03-10", { enterpriseId: maize, seasonId: season });
  await record("SALE", seed.eggSales, "3200000", "2027-05-01", { enterpriseId: poultry, seasonId: season });
  await record("PURCHASE", seed.feed, "2400000", "2027-04-01", { enterpriseId: poultry, seasonId: season });
  await record("INCOME", seed.otherIncome, "1400000", "2027-07-01", { enterpriseId: bananas, seasonId: season });
  await record("EXPENSE", seed.fertilizer, "650000", "2027-03-11", { enterpriseId: bananas, seasonId: season });
  // Outside the season: an unlinked shared cost, and a record dated inside the season but linked to another.
  await record("EXPENSE", seed.rent, "300000", "2027-04-15");
  await record("EXPENSE", seed.feed, "5000", "2027-04-16", { enterpriseId: poultry, seasonId: otherSeason });
}, 60_000);
afterAll(async () => {
  const tenants = [tenantA, tenantB].filter(Boolean), actors = Object.values(users), where = { tenantId: { in: tenants } };
  try {
    await owner.accountingReversal.deleteMany({ where }); await owner.paymentAllocation.deleteMany({ where });
    await owner.paymentRecord.deleteMany({ where }); await owner.accountingRecord.deleteMany({ where });
    await owner.cropCycle.deleteMany({ where }); await owner.season.deleteMany({ where }); await owner.enterprise.deleteMany({ where }); await owner.plot.deleteMany({ where });
    await owner.auditEvent.deleteMany({ where: { actorId: { in: actors } } });
    await owner.farmMember.deleteMany({ where: { userId: { in: actors } } }); await owner.farm.deleteMany({ where });
    await owner.farmerProfile.deleteMany({ where: { farmer: { userId: { in: actors } } } }); await owner.farmer.deleteMany({ where: { userId: { in: actors } } });
    await owner.membership.deleteMany({ where: { userId: { in: actors } } }); await owner.organization.deleteMany({ where: { id: { in: tenants } } }); await owner.user.deleteMany({ where: { id: { in: actors } } });
  } finally { await Promise.all([owner.$disconnect(), runtime.$disconnect()]); }
});

describe("AC001 dashboard with the real restricted runtime role (P08-T002)", () => {
  it("opens on the latest active season and reproduces the source dashboard", async () => {
    const result = await dashboards().dashboard(farm);
    expect(result).toMatchObject({ basis: "ACCRUAL", from: null, to: null, asOf: now.toISOString(), season: { seasonId: season, label: "2027A", status: "ACTIVE", startDate: "2027-03-01", endDate: null } });
    expect(result.currencies).toHaveLength(1);
    expect(result.currencies[0]).toMatchObject({ currency: "UGX", revenue: "8400000", expenses: "5150000", recordedSurplus: "3250000", surplusMargin: { status: "AVAILABLE", value: "38.7" }, topEnterpriseIds: [maize] });
    expect(result.currencies[0].enterprises.map(row => [row.name, row.revenue, row.directCosts, row.grossMargin])).toEqual([
      ["Maize", "3800000", "2100000", "1700000"], ["Poultry", "3200000", "2400000", "800000"], ["Bananas", "1400000", "650000", "750000"],
    ]);
  });
  it("names what has no season, and leaves out a record linked to another season despite its date", async () => {
    expect((await dashboards().dashboard(farm)).notLinkedToSeason).toEqual([{ currency: "UGX", revenue: "0", costs: "300000" }]);
    const other = await dashboards().dashboard(farm, { seasonId: otherSeason });
    expect(other.season?.label).toBe("2026B");
    expect(other.currencies[0]).toMatchObject({ revenue: "0", expenses: "5000", recordedSurplus: "-5000", surplusMargin: { status: "UNAVAILABLE", reason: "NO_REVENUE" } });
  });
  it("all records deducts the shared cost and agrees with the gross margin report", async () => {
    const all = await dashboards().dashboard(farm, { seasonId: "all" }), margin = await reports().grossMargin(farm);
    expect(all.season).toBeNull();
    expect(all.notLinkedToSeason).toEqual([]);
    expect(all.currencies[0]).toMatchObject({ revenue: "8400000", expenses: "5455000", recordedSurplus: "2945000", unassigned: { revenue: "0", costs: "300000" } });
    expect(all.currencies[0].allEnterprises).toEqual(margin.currencies[0].farm);
  });
  it("filters by dates, and lists seasons newest first", async () => {
    const april = await dashboards().dashboard(farm, { from: "2027-04-01", to: "2027-04-30" });
    expect(april).toMatchObject({ season: null, from: "2027-04-01", to: "2027-04-30" });
    expect(april.currencies[0]).toMatchObject({ revenue: "0", expenses: "2705000" });
    expect(april.seasons.map(row => row.label)).toEqual(["2027B", "2027A", "2026B"]);
  });
  it("the cash view counts only money that moved, within the season it was linked to", async () => {
    const cash = await dashboards().dashboard(farm, { basis: "CASH" });
    expect(cash.currencies[0]).toMatchObject({ revenue: "1400000", expenses: "2750000", recordedSurplus: "-1350000" });
  });
  it("opens a closed season when asked, and reads all records when no season is active", async () => {
    expect((await dashboards().dashboard(farm, { seasonId: closedSeason })).currencies).toEqual([]);
    const lone = await production("a").createSeason(empty, { requestId: id(), label: "Done", startDate: "2027-01-01" });
    await owner.season.update({ where: { id: lone.seasonId }, data: { status: "CLOSED" } });
    expect(await dashboards().dashboard(empty)).toMatchObject({ season: null, currencies: [], notLinkedToSeason: [] });
  });
  it("a reversal leaves the figures, and another currency stays apart", async () => {
    const wrong = await record("EXPENSE", seed.fertilizer, "1000000", "2027-03-12", { enterpriseId: maize, seasonId: season });
    const usd = await record("INCOME", seed.otherIncome, "10", "2027-07-02", { enterpriseId: maize, seasonId: season }, "USD");
    try {
      const raised = await dashboards().dashboard(farm);
      expect(raised.currencies.map(row => [row.currency, row.expenses, row.revenue])).toEqual([["UGX", "6150000", "8400000"], ["USD", "0", "10"]]);
    } finally {
      await accounts().reverse(farm, { requestId: id(), recordType: "EXPENSE", recordId: wrong.recordId, reason: "Entered twice" });
      await accounts().reverse(farm, { requestId: id(), recordType: "INCOME", recordId: usd.recordId, reason: "Test currency" });
    }
    const restored = await dashboards().dashboard(farm);
    expect(restored.currencies.map(row => [row.currency, row.expenses, row.revenue])).toEqual([["UGX", "5150000", "8400000"]]);
  });
  it("reading writes nothing, so a repeated request gives the same answer", async () => {
    const before = await owner.auditEvent.count();
    expect(await dashboards().dashboard(farm)).toEqual(await dashboards().dashboard(farm));
    expect(await owner.auditEvent.count()).toBe(before);
  });
});

describe("dashboard authorization (P08-T002)", () => {
  it("denies another tenant, a guessed farm, an admin who farms nothing and a revoked member", async () => {
    await expect(dashboards("b").dashboard(farm)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dashboards().dashboard(farmB)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dashboards().dashboard(id())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dashboards("admin").dashboard(farm)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(dashboards("revoked").dashboard(farm)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("denies a season of another farm or tenant, the same as one that does not exist", async () => {
    const own = await production("a").createSeason(empty, { requestId: id(), label: "Other farm", startDate: "2027-02-01" });
    for (const seasonId of [foreignSeason, own.seasonId, id()]) await expect(dashboards().dashboard(farm, { seasonId })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("refuses forged scope and bad filters", async () => {
    for (const input of [{ tenantId: tenantB }, { farmId: farmB }, { actorId: users.b }, { seasonId: season, from: "2027-01-01" }, { basis: "NET" }, { from: "2027-02-30" }]) {
      await expect(dashboards().dashboard(farm, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
});
