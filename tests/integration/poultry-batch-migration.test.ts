import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";
import { runSqlFile, supabaseEmulation } from "../support/provisioning";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Migration tests require an isolated loopback database.");
const admin = new Client({ connectionString: url });
const name = "myfarm_poultry_upgrade_" + crypto.randomUUID().replaceAll("-", "");
const target = new URL(url); target.pathname = "/" + name;
const upgrade = new Client({ connectionString: target.toString() });
const migration = readFileSync("prisma/migrations/202610190001_poultry_batches/migration.sql", "utf8");
const user = crypto.randomUUID(), tenant = crypto.randomUUID(), farmer = crypto.randomUUID(), farm = crypto.randomUUID();
let created = false;
beforeAll(async () => {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true; await upgrade.connect();
  for (const part of ["202610080001_foundation", "202610080101_private_grant_rate_limit", "202610090001_farmer_registry", "202610180001_enterprises_seasons", "202610180002_crop_cycles"]) await upgrade.query(readFileSync(`prisma/migrations/${part}/migration.sql`, "utf8"));
  await runSqlFile(upgrade, supabaseEmulation);
  await upgrade.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [user, crypto.randomUUID()]);
  await upgrade.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Upgrade fixture\',\'PERSONAL\')', [tenant]);
  await upgrade.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)', [farmer, user, tenant]);
  await upgrade.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Existing farm\',\'Rukungiri\',\'OWNED\',\'POULTRY\',$4)', [farm, tenant, farmer, user]);
  await upgrade.query('INSERT INTO "Enterprise" (id,"tenantId","farmId",name,type,"createdBy") VALUES ($1,$2,$3,\'Existing layers\',\'POULTRY\',$4)', [crypto.randomUUID(), tenant, farm, user]);
}, 30_000);
afterAll(async () => {
  await upgrade.end(); if (created) await admin.query(`DROP DATABASE "${name}"`); await admin.end();
});
describe("T008 additive upgrade", () => {
  it("rolls the entire migration back on failure, then preserves prior rows on successful upgrade", async () => {
    const snapshot = async () => (await upgrade.query('SELECT row_to_json(f) AS farm, row_to_json(e) AS enterprise, (SELECT json_agg(c ORDER BY c.id) FROM "CropCatalog" c) AS crops FROM "Farm" f JOIN "Enterprise" e ON e."farmId"=f.id')).rows;
    const before = await snapshot();
    await expect(upgrade.query(migration.replace(/COMMIT;\s*$/, "SELECT 1/0;\nCOMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await upgrade.query("ROLLBACK");
    expect((await upgrade.query("SELECT to_regclass('public.\"PoultryBatch\"') AS batch, to_regclass('public.\"AnimalTypeCatalog\"') AS catalog, to_regtype('public.\"PoultryPurpose\"') AS purpose")).rows[0]).toEqual({ batch: null, catalog: null, purpose: null });
    expect(await snapshot()).toEqual(before);
    await upgrade.query(migration); expect(await snapshot()).toEqual(before);
    expect((await upgrade.query('SELECT name FROM "AnimalTypeCatalog" ORDER BY "createdAt" DESC, id DESC')).rows).toEqual([{ name: "Chicken" }, { name: "Duck" }, { name: "Turkey" }, { name: "Guinea fowl" }]);
    expect((await upgrade.query('SELECT count(*)::int AS n FROM "PoultryBatch"')).rows[0].n).toBe(0);
  });
  it("has deny-all RLS before provider grants, even if table privileges are granted", async () => {
    await upgrade.query('GRANT USAGE ON SCHEMA public TO anon');
    await upgrade.query('GRANT SELECT, INSERT ON "PoultryBatch", "AnimalTypeCatalog" TO anon');
    await upgrade.query("SET ROLE anon");
    try {
      expect((await upgrade.query('SELECT * FROM "PoultryBatch"')).rows).toEqual([]);
      expect((await upgrade.query('SELECT * FROM "AnimalTypeCatalog"')).rows).toEqual([]);
      await expect(upgrade.query('INSERT INTO "AnimalTypeCatalog" (id,name) VALUES ($1,\'Forbidden\')', [crypto.randomUUID()])).rejects.toMatchObject({ code: "42501" });
    } finally { await upgrade.query("RESET ROLE"); }
    expect((await upgrade.query("SELECT relname FROM pg_class WHERE relname IN ('PoultryBatch','AnimalTypeCatalog') AND relrowsecurity ORDER BY relname")).rows).toEqual([{ relname: "AnimalTypeCatalog" }, { relname: "PoultryBatch" }]);
  });
});
