import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) {
  throw new Error("Integration requires isolated local myfarm_phase01_test database.");
}
const db = new Client({ connectionString: url });
const uuid = () => crypto.randomUUID();
const a = { user: uuid(), tenant: uuid(), farmer: uuid(), farm: uuid() };
const b = { user: uuid(), tenant: uuid(), farmer: uuid(), farm: uuid() };
const migration = readFileSync("prisma/migrations/202610180001_enterprises_seasons/migration.sql", "utf8");
const upgradeName = "myfarm_phase03_upgrade_" + uuid().replaceAll("-", "");
const probeRole = "phase03_probe_" + uuid().replaceAll("-", "");
let upgrade: Client | undefined;
let createdUpgrade = false;
let createdRole = false;

async function seed(client: Client, scope: typeof a) {
  await client.query('INSERT INTO "User" (id, "authSubject") VALUES ($1, $2)', [scope.user, uuid()]);
  await client.query('INSERT INTO "Organization" (id, name, kind) VALUES ($1, $2, \'PERSONAL\')', [scope.tenant, "Phase 3 fixture"]);
  await client.query('INSERT INTO "Membership" ("userId", "organizationId", role) VALUES ($1, $2, \'FARMER\')', [scope.user, scope.tenant]);
  await client.query('INSERT INTO "Farmer" (id, "userId", "tenantId") VALUES ($1, $2, $3)', [scope.farmer, scope.user, scope.tenant]);
  await client.query('INSERT INTO "Farm" (id, "tenantId", "ownerFarmerId", name, district, "ownershipType", "primaryActivity", "createdBy") VALUES ($1, $2, $3, $4, $5, \'OWNED\', \'CROPS\', $6)', [scope.farm, scope.tenant, scope.farmer, "Foundation farm", "Rukungiri", scope.user]);
}
const enterprise = (scope: typeof a, name = "Maize", version = 1) => db.query(
  'INSERT INTO "Enterprise" (id, "tenantId", "farmId", type, name, "createdBy", version) VALUES ($1, $2, $3, \'CROP\', $4, $5, $6) RETURNING *',
  [uuid(), scope.tenant, scope.farm, name, scope.user, version],
);
const season = (scope: typeof a, start = "2026-03-01", end: string | null = null, version = 1) => db.query(
  'INSERT INTO "Season" (id, "tenantId", "farmId", label, "startDate", "endDate", "createdBy", version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
  [uuid(), scope.tenant, scope.farm, "Season A", start, end, scope.user, version],
);

beforeAll(async () => {
  await db.connect();
  await seed(db, a); await seed(db, b);
});
afterAll(async () => {
  await db.query("RESET ROLE");
  if (upgrade) await upgrade.end();
  if (createdUpgrade) await db.query(`DROP DATABASE "${upgradeName}"`);
  if (createdRole) { await db.query(`DROP OWNED BY "${probeRole}"`); await db.query(`DROP ROLE "${probeRole}"`); }
  const actors = [a.user, b.user], tenants = [a.tenant, b.tenant];
  await db.query('DELETE FROM "Enterprise" WHERE "createdBy" = ANY($1::uuid[])', [actors]);
  await db.query('DELETE FROM "Season" WHERE "createdBy" = ANY($1::uuid[])', [actors]);
  await db.query('DELETE FROM "Farm" WHERE "tenantId" = ANY($1::uuid[])', [tenants]);
  await db.query('DELETE FROM "Farmer" WHERE "userId" = ANY($1::uuid[])', [actors]);
  await db.query('DELETE FROM "Membership" WHERE "userId" = ANY($1::uuid[])', [actors]);
  await db.query('DELETE FROM "Organization" WHERE id = ANY($1::uuid[])', [tenants]);
  await db.query('DELETE FROM "User" WHERE id = ANY($1::uuid[])', [actors]);
  await db.end();
});

describe("Phase 3 additive foundation schema (T001)", () => {
  it("persists enterprise and season identities in separate farm scopes", async () => {
    const first = (await enterprise(a)).rows[0], second = (await enterprise(b, "Coffee")).rows[0];
    expect(first).toMatchObject({ tenantId: a.tenant, farmId: a.farm, status: "ACTIVE", version: 1 });
    expect(second).toMatchObject({ tenantId: b.tenant, farmId: b.farm, name: "Coffee" });
    expect((await db.query('SELECT id FROM "Enterprise" WHERE "tenantId" = $1 AND "farmId" = $2', [a.tenant, b.farm])).rows).toEqual([]);
  });
  it("composite foreign keys reject another tenant's farm on either table", async () => {
    await expect(enterprise({ ...a, farm: b.farm })).rejects.toMatchObject({ code: "23503" });
    await expect(season({ ...a, farm: b.farm })).rejects.toMatchObject({ code: "23503" });
  });
  it("allows overlapping seasons, including a missing expected end", async () => {
    await season(a, "2026-03-01", "2026-08-01");
    await season(a, "2026-04-01", "2026-09-01");
    expect((await season(a)).rows[0].endDate).toBeNull();
  });
  it("enforces date order, finite supported dates, labels and versions", async () => {
    await expect(season(a, "2026-03-01", "2026-02-28")).rejects.toMatchObject({ code: "23514" });
    await expect(season(a, "infinity")).rejects.toMatchObject({ code: "23514" });
    await expect(season(a, "0001-01-01 BC")).rejects.toMatchObject({ code: "23514" });
    await expect(season(a, "2026-03-01", "infinity")).rejects.toMatchObject({ code: "23514" });
    await expect(season(a, "2026-03-01", null, 0)).rejects.toMatchObject({ code: "23514" });
    await expect(enterprise(a, "   ")).rejects.toMatchObject({ code: "23514" });
    await expect(enterprise(a, "Maize", 0)).rejects.toMatchObject({ code: "23514" });
    await expect(db.query('UPDATE "Season" SET label = \'   \' WHERE "farmId" = $1', [a.farm])).rejects.toMatchObject({ code: "23514" });
  });
  it("new tables deny browser-like roles even if default privileges grant table access", async () => {
    await db.query(`CREATE ROLE "${probeRole}"`); createdRole = true;
    await db.query(`GRANT USAGE ON SCHEMA public TO "${probeRole}"`);
    await db.query(`GRANT SELECT, INSERT ON "Enterprise", "Season" TO "${probeRole}"`);
    await db.query(`SET ROLE "${probeRole}"`);
    try {
      expect((await db.query('SELECT * FROM "Enterprise"')).rows).toEqual([]);
      expect((await db.query('SELECT * FROM "Season"')).rows).toEqual([]);
      await expect(enterprise(a, "Forbidden")).rejects.toMatchObject({ code: "42501" });
      await expect(season(a)).rejects.toMatchObject({ code: "42501" });
    } finally { await db.query("RESET ROLE"); }
  });
  it("upgrades the actual Phase 2 SQL chain atomically and preserves prior rows", async () => {
    await db.query(`CREATE DATABASE "${upgradeName}"`); createdUpgrade = true;
    const target = new URL(url!); target.pathname = "/" + upgradeName;
    upgrade = new Client({ connectionString: target.toString() }); await upgrade.connect();
    for (const name of ["202610080001_foundation", "202610080101_private_grant_rate_limit", "202610090001_farmer_registry"]) {
      await upgrade.query(readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));
    }
    await seed(upgrade, a);
    const before = (await upgrade.query('SELECT row_to_json(f) AS row FROM "Farm" f')).rows;
    await expect(upgrade.query(migration.replace(/COMMIT;\s*$/, "SELECT 1/0;\nCOMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await upgrade.query("ROLLBACK");
    expect((await upgrade.query("SELECT to_regclass('public.\"Enterprise\"') AS table_name, to_regtype('public.\"EnterpriseType\"') AS type_name")).rows[0]).toEqual({ table_name: null, type_name: null });
    await upgrade.query(migration);
    expect((await upgrade.query('SELECT row_to_json(f) AS row FROM "Farm" f')).rows).toEqual(before);
    expect((await upgrade.query('SELECT count(*)::int AS count FROM "Enterprise"')).rows[0].count).toBe(0);
    expect((await upgrade.query("SELECT relname FROM pg_class WHERE relname IN ('Enterprise', 'Season') AND relrowsecurity ORDER BY relname")).rows.map(row => row.relname)).toEqual(["Enterprise", "Season"]);
  });
});
