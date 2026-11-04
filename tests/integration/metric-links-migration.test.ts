import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";

it("the metric links migration rolls back atomically, keeps prior records and groups only the approved categories", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Isolated loopback database required");
  const admin = new Client({ connectionString: url }); await admin.connect();
  const name = "myfarm_metric_upgrade_" + crypto.randomUUID().replaceAll("-", "");
  const target = new URL(url); target.pathname = "/" + name;
  await admin.query('CREATE DATABASE "' + name + '"');
  const db = new Client({ connectionString: target.toString() }); await db.connect();
  try {
    const release = "202611040001_metric_links";
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p < release).sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    const before = (await db.query('SELECT count(*)::int AS n FROM "TransactionCategory"')).rows[0].n;
    const sql = readFileSync("prisma/migrations/" + release + "/migration.sql", "utf8");
    await expect(db.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await db.query("ROLLBACK");
    expect((await db.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'AccountingRecord' AND column_name = 'batchId'`)).rows[0].n).toBe(0);
    await db.query(sql);
    expect((await db.query('SELECT count(*)::int AS n FROM "TransactionCategory"')).rows[0].n).toBe(before);
    const groups = (await db.query('SELECT name, "costGroup" AS group FROM "TransactionCategory" WHERE "costGroup" IS NOT NULL ORDER BY "costGroup", name')).rows;
    expect(groups).toEqual([
      { name: "Labour", group: "LABOUR" },
      ...["Feed", "Fertilizer", "Medication", "Pesticides", "Seeds", "Veterinary"].map(input => ({ name: input, group: "INPUT" })),
    ]);
    // A revenue category can never carry a cost group.
    await expect(db.query(`UPDATE "TransactionCategory" SET "costGroup" = 'INPUT' WHERE kind = 'REVENUE'`)).rejects.toMatchObject({ code: "23514" });
  } finally { await db.end(); await admin.query('DROP DATABASE "' + name + '"'); await admin.end(); }
}, 30_000);
