import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { config } from "dotenv";
import { Client } from "pg";
import { applyCatalogRelease, type CatalogEntry } from "@/modules/enterprises-seasons/domain/catalog";
import { catalogReleaseSchema } from "@/modules/enterprises-seasons/contracts/catalog";
import { applyProviderSql, runSqlFile, supabaseEmulation } from "../support/provisioning";

config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Catalog release tests require an isolated loopback database.");
const admin = new Client({ connectionString: url });
const name = "myfarm_catalog_upgrade_" + crypto.randomUUID().replaceAll("-", "");
const target = new URL(url); target.pathname = "/" + name;
const upgrade = new Client({ connectionString: target.toString() });
const releaseName = "202610250001_crop_catalog_release";
const sql = readFileSync(`prisma/migrations/${releaseName}/migration.sql`, "utf8");
const approved = ["Beans", "Bananas (matooke)", "Cassava", "Sweet potatoes", "Irish potatoes", "Groundnuts", "Sorghum", "Millet", "Sunflower", "Tea", "Tomatoes", "Cabbage"];
// Read the real SQL payload, so the domain oracle verifies the actual shipped release.
const release = catalogReleaseSchema.parse({ additions: [...sql.matchAll(/\('([0-9a-f-]+)', '([^']+)'\)/g)].map(([, id, name]) => ({ id, name })) });
const snapshot = async () => (await upgrade.query<CatalogEntry>('SELECT id, name, active FROM "CropCatalog" ORDER BY id')).rows;
let created = false;
beforeAll(async () => {
  await admin.connect(); await admin.query(`CREATE DATABASE "${name}"`); created = true; await upgrade.connect();
  for (const part of readdirSync("prisma/migrations").filter(part => /^\d/.test(part) && part < releaseName).sort()) {
    await upgrade.query(readFileSync(`prisma/migrations/${part}/migration.sql`, "utf8"));
  }
  await runSqlFile(upgrade, supabaseEmulation); await applyProviderSql(upgrade);
}, 30_000);
afterAll(async () => {
  await upgrade.end(); if (created) await admin.query(`DROP DATABASE "${name}"`); await admin.end();
});

describe("T011 reviewed crop data release", () => {
  it("rolls every addition back on partial failure", async () => {
    const before = await snapshot();
    await expect(upgrade.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0;\nCOMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await upgrade.query("ROLLBACK"); expect(await snapshot()).toEqual(before);
  });
  it("refuses case/whitespace collisions with inactive entries without partial additions", async () => {
    const id = crypto.randomUUID();
    await upgrade.query('INSERT INTO "CropCatalog" (id, name, active) VALUES ($1,$2,false)', [id, "  bEANS  "]);
    const before = await snapshot();
    expect(() => applyCatalogRelease(before, release)).toThrow(expect.objectContaining({ code: "CONFLICT" }));
    await expect(upgrade.query(sql)).rejects.toMatchObject({ code: "23505" });
    await upgrade.query("ROLLBACK"); expect(await snapshot()).toEqual(before);
    await upgrade.query('DELETE FROM "CropCatalog" WHERE id=$1', [id]);
  });
  it("matches the domain release against the real pre-release catalog and preserves old rows", async () => {
    expect(release.additions.map(entry => entry.name)).toEqual(approved);
    const before = await snapshot();
    const oldRows = (await upgrade.query('SELECT * FROM "CropCatalog" ORDER BY id')).rows;
    const expected = applyCatalogRelease(before, release).sort((a, b) => a.id.localeCompare(b.id));
    await upgrade.query(sql); expect(await snapshot()).toEqual(expected);
    expect((await upgrade.query('SELECT * FROM "CropCatalog" WHERE id=ANY($1::uuid[]) ORDER BY id', [before.map(entry => entry.id)])).rows).toEqual(oldRows);
  });
  it("keeps runtime catalog access read-only and browser access denied", async () => {
    await upgrade.query("SET ROLE myfarm_runtime");
    try {
      expect((await snapshot()).length).toBe(14);
      await expect(upgrade.query('INSERT INTO "CropCatalog" (id,name) VALUES ($1,$2)', [crypto.randomUUID(), "Forbidden"])).rejects.toMatchObject({ code: "42501" });
      await expect(upgrade.query('UPDATE "CropCatalog" SET active=false')).rejects.toMatchObject({ code: "42501" });
      await expect(upgrade.query('DELETE FROM "CropCatalog"')).rejects.toMatchObject({ code: "42501" });
    } finally { await upgrade.query("RESET ROLE"); }
    await upgrade.query("SET ROLE anon");
    try { await expect(snapshot()).rejects.toMatchObject({ code: "42501" }); }
    finally { await upgrade.query("RESET ROLE"); }
  });
});
