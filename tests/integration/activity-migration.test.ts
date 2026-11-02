import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

it("the activity migration rolls back atomically and preserves prior records", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Isolated loopback database required");
  const admin = new Client({ connectionString: url }); await admin.connect();
  const name = "myfarm_activity_upgrade_" + crypto.randomUUID().replaceAll("-", "");
  const target = new URL(url); target.pathname = "/" + name;
  await admin.query('CREATE DATABASE "' + name + '"');
  const db = new Client({ connectionString: target.toString() }); await db.connect();
  try {
    const release = "202611020001_production_activities";
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p < release).sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    const actor = crypto.randomUUID();
    await db.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [actor, crypto.randomUUID()]);
    const sql = readFileSync("prisma/migrations/" + release + "/migration.sql", "utf8");
    await expect(db.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await db.query("ROLLBACK");
    expect((await db.query("SELECT to_regclass('public.\"ProductionActivity\"') AS table")).rows[0].table).toBeNull();
    await db.query(sql);
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p > release).sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    expect((await db.query('SELECT id FROM "User"')).rows).toEqual([{ id: actor }]);
    expect((await db.query("SELECT relrowsecurity AS rls FROM pg_class WHERE oid='public.\"ProductionActivity\"'::regclass")).rows[0].rls).toBe(true);
  } finally { await db.end(); await admin.query('DROP DATABASE "' + name + '"'); await admin.end(); }
}, 30_000);
