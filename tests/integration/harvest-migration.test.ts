import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

it("harvest migrations roll back atomically, preserve prior records and enforce composite provenance", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Isolated loopback database required");
  const admin = new Client({ connectionString: url }); await admin.connect();
  const name = "myfarm_harvest_upgrade_" + crypto.randomUUID().replaceAll("-", "");
  const target = new URL(url); target.pathname = "/" + name;
  await admin.query('CREATE DATABASE "' + name + '"');
  const db = new Client({ connectionString: target.toString() }); await db.connect();
  try {
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p < "202610290001").sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    const actor = crypto.randomUUID();
    await db.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [actor, crypto.randomUUID()]);
    const sql = readFileSync("prisma/migrations/202610290001_harvest_inventory/migration.sql", "utf8");
    await expect(db.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await db.query("ROLLBACK");
    expect((await db.query("SELECT to_regclass('public.\"Harvest\"') AS table")).rows[0].table).toBeNull();
    await db.query(sql); await db.query(readFileSync("prisma/migrations/202610290002_harvest_scope/migration.sql", "utf8"));
    expect((await db.query('SELECT id FROM "User"')).rows).toEqual([{ id: actor }]);
    expect((await db.query("SELECT count(*)::int AS n FROM pg_class WHERE relname IN ('Harvest','StockMovement','StorageLocation','InventoryItem') AND relrowsecurity")).rows[0].n).toBe(4);
    const fk = await db.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='\"Harvest\"'::regclass AND contype='f'");
    expect(fk.rows.some(r => r.def.includes('"cropCycleId", "plotId", "cropId", "farmId", "tenantId"'))).toBe(true);
  } finally { await db.end(); await admin.query('DROP DATABASE "' + name + '"'); await admin.end(); }
}, 30_000);
