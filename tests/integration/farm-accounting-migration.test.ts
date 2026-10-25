import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";
import { runSqlFile, supabaseEmulation } from "../support/provisioning";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Migration tests require an isolated loopback database.");
const admin = new Client({ connectionString: url });
const name = "myfarm_accounting_upgrade_" + crypto.randomUUID().replaceAll("-", "");
const target = new URL(url); target.pathname = "/" + name;
const upgrade = new Client({ connectionString: target.toString() });
const migration = readFileSync("prisma/migrations/202610250002_farm_accounting/migration.sql", "utf8");
const prior = ["202610080001_foundation", "202610080101_private_grant_rate_limit", "202610090001_farmer_registry", "202610180001_enterprises_seasons", "202610180002_crop_cycles", "202610190001_poultry_batches", "202610250001_crop_catalog_release"];
const tables = ["AccountingRecord", "AccountingReversal", "PaymentAllocation", "PaymentMethod", "PaymentRecord", "TransactionCategory"];
const user = crypto.randomUUID(), tenant = crypto.randomUUID(), farmer = crypto.randomUUID(), farm = crypto.randomUUID();
let created = false;
beforeAll(async () => {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true; await upgrade.connect();
  for (const part of prior) await upgrade.query(readFileSync(`prisma/migrations/${part}/migration.sql`, "utf8"));
  await runSqlFile(upgrade, supabaseEmulation);
  await upgrade.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [user, crypto.randomUUID()]);
  await upgrade.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Upgrade fixture\',\'PERSONAL\')', [tenant]);
  await upgrade.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)', [farmer, user, tenant]);
  await upgrade.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Existing farm\',\'Rukungiri\',\'OWNED\',\'CROPS\',$4)', [farm, tenant, farmer, user]);
  await upgrade.query('INSERT INTO "Enterprise" (id,"tenantId","farmId",name,type,"createdBy") VALUES ($1,$2,$3,\'Existing maize\',\'CROP\',$4)', [crypto.randomUUID(), tenant, farm, user]);
}, 30_000);
afterAll(async () => {
  await upgrade.end(); if (created) await admin.query(`DROP DATABASE "${name}"`); await admin.end();
});
describe("T002 additive upgrade", () => {
  it("rolls the entire migration back on failure, then preserves prior rows and seeds the approved catalogs", async () => {
    const snapshot = async () => (await upgrade.query('SELECT row_to_json(f) AS farm, row_to_json(e) AS enterprise, (SELECT count(*)::int FROM "CropCatalog") AS crops, (SELECT count(*)::int FROM "AnimalTypeCatalog") AS animals FROM "Farm" f JOIN "Enterprise" e ON e."farmId"=f.id')).rows;
    const before = await snapshot();
    await expect(upgrade.query(migration.replace(/COMMIT;\s*$/, "SELECT 1/0;\nCOMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await upgrade.query("ROLLBACK");
    expect((await upgrade.query("SELECT to_regclass('public.\"AccountingRecord\"') AS records, to_regtype('public.\"AccountingStatus\"') AS status")).rows[0]).toEqual({ records: null, status: null });
    expect(await snapshot()).toEqual(before);
    await upgrade.query(migration); expect(await snapshot()).toEqual(before);
    const names = async (sql: string) => (await upgrade.query(sql)).rows.map(row => row.name);
    expect(await names('SELECT name FROM "TransactionCategory" WHERE kind = \'COST\' ORDER BY "createdAt" DESC, id DESC')).toEqual(["Seeds", "Feed", "Fertilizer", "Veterinary", "Labour", "Transport", "Fuel", "Equipment", "Rent", "Utilities", "Medication", "Pesticides", "Packaging"]);
    expect(await names('SELECT name FROM "TransactionCategory" WHERE kind = \'REVENUE\' ORDER BY "createdAt" DESC, id DESC')).toEqual(["Crop sales", "Livestock sales", "Egg sales", "Other income"]);
    expect(await names('SELECT name FROM "PaymentMethod" ORDER BY "createdAt" DESC, id DESC')).toEqual(["Cash", "Mobile Money", "Bank transfer"]);
    expect((await upgrade.query('SELECT count(*)::int AS n FROM "AccountingRecord"')).rows[0].n).toBe(0);
  });
  it("enforces money, method and reversal-target checks as the table owner", async () => {
    const insert = (amount: string, currency: string, kind: string, method: string | null) => upgrade.query(
      'INSERT INTO "AccountingRecord" (id,"tenantId","farmId",kind,"categoryId","categoryName",amount,currency,"occurredOn","paymentMethodId","createdBy") VALUES ($1,$2,$3,$4,\'f4040002-0000-4000-8000-000000000204\',\'Crop sales\',$5,$6,\'2027-06-01\',$7,$8)',
      [crypto.randomUUID(), tenant, farm, kind, amount, currency, method, user]);
    for (const [amount, currency, kind, method] of [["0", "UGX", "SALE", null], ["-1", "UGX", "SALE", null], ["1", "ugx", "SALE", null], ["1", "UGX", "SALE", "f4040002-0000-4000-8000-000000000303"]] as const) {
      await expect(insert(amount, currency, kind, method)).rejects.toMatchObject({ code: "23514" });
    }
    await expect(insert("1.00001", "UGX", "SALE", null)).resolves.toBeDefined();
    expect((await upgrade.query('SELECT amount::text FROM "AccountingRecord"')).rows).toEqual([{ amount: "1.0000" }]);
    await expect(upgrade.query('INSERT INTO "AccountingReversal" (id,"tenantId","farmId",reason,"createdBy") VALUES ($1,$2,$3,\'x\',$4)', [crypto.randomUUID(), tenant, farm, user])).rejects.toMatchObject({ code: "23514" });
    await upgrade.query('DELETE FROM "AccountingRecord"');
  });
  it("has deny-all RLS before provider grants, even if table privileges are granted", async () => {
    await upgrade.query("GRANT USAGE ON SCHEMA public TO anon");
    await upgrade.query(`GRANT SELECT, INSERT ON ${tables.map(t => `"${t}"`).join(", ")} TO anon`);
    await upgrade.query("SET ROLE anon");
    try {
      for (const table of tables) expect((await upgrade.query(`SELECT * FROM "${table}"`)).rows).toEqual([]);
      await expect(upgrade.query('INSERT INTO "PaymentMethod" (id,name) VALUES ($1,\'Forbidden\')', [crypto.randomUUID()])).rejects.toMatchObject({ code: "42501" });
    } finally { await upgrade.query("RESET ROLE"); }
    expect((await upgrade.query("SELECT relname FROM pg_class WHERE relname = ANY($1) AND relrowsecurity ORDER BY relname", [tables])).rows.map(row => row.relname)).toEqual(tables);
  });
});
