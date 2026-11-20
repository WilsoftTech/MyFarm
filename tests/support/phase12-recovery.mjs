// Actual dump/restore of synthetic voice confirmation history. Never targets hosted/shared data.
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Voice recovery requires the isolated loopback test database");
const connection = new URL(url), container = process.env.MYFARM_TEST_CONTAINER, bin = process.env.MYFARM_PG_BIN;
if (container && !/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Invalid test container");
if (!container && !bin) throw new Error("Set the local PostgreSQL bin directory or disposable test container");
function pg(program, database, args, input) {
  const options = { input, maxBuffer: 64 * 1024 * 1024 };
  if (container) return execFileSync("docker", ["exec", ...(input ? ["-i"] : []), container, program, "-U", decodeURIComponent(connection.username), "-d", database, ...args], options);
  return execFileSync(path.join(bin, program + (process.platform === "win32" ? ".exe" : "")), ["-h", connection.hostname, "-p", connection.port, "-U", decodeURIComponent(connection.username), "-d", database, ...args], { ...options, env: { ...process.env, PGPASSWORD: decodeURIComponent(connection.password) } });
}
const user = randomUUID(), tenant = randomUUID(), farmer = randomUUID(), farm = randomUUID(), draft = randomUUID(), record = randomUUID(), request = randomUUID();
const category = "f4040002-0000-4000-8000-000000000112";
const review = { schemaVersion: 1, kind: "EXPENSE", command: { requestId: request, categoryId: category, amount: "180000", currency: "UGX", occurredOn: "2026-11-20" }, bags: 2 };
const hash = createHash("sha256").update(JSON.stringify({ schemaVersion: 1, tenantId: tenant, farmId: farm, actorId: user, version: 1, review })).digest("hex");
const restoreName = "myfarm_p12_restore_" + randomUUID().replaceAll("-", "");
if (!/^myfarm_p12_restore_[a-f0-9]{32}$/.test(restoreName)) throw new Error("Unsafe restore database name");
const restoredUrl = new URL(url); restoredUrl.pathname = "/" + restoreName;
const source = new Client({ connectionString: url }), restored = new Client({ connectionString: restoredUrl.toString() });
let created = false, connected = false;
const snapshot = async db => ({
  draft: (await db.query('SELECT id,"actorId","farmId","tenantId","requestId",review,"payloadHash",version,"createdAt","expiresAt","confirmedAt","accountingRecordId" FROM "VoiceExpenseDraft" WHERE id=$1', [draft])).rows,
  record: (await db.query('SELECT id,amount::text,currency,kind,"createdBy" FROM "AccountingRecord" WHERE id=$1', [record])).rows,
  audits: (await db.query('SELECT action,"targetId","requestId" FROM "AuditEvent" WHERE "tenantId"=$1 ORDER BY action', [tenant])).rows,
  grants: (await db.query(`SELECT has_table_privilege('myfarm_runtime','"VoiceExpenseDraft"','SELECT') AS read,
    has_table_privilege('myfarm_runtime','"VoiceExpenseDraft"','DELETE') AS delete,
    has_table_privilege('authenticated','"VoiceExpenseDraft"','SELECT') AS browser,
    (SELECT relrowsecurity FROM pg_class WHERE oid='"VoiceExpenseDraft"'::regclass) AS rls`)).rows,
});
await source.connect();
try {
  await source.query("BEGIN");
  await source.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [user, randomUUID()]);
  await source.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Voice recovery\',\'PERSONAL\')', [tenant]);
  await source.query('INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,\'FARMER\')', [user, tenant]);
  await source.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)', [farmer, user, tenant]);
  await source.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Voice recovery farm\',\'Rukungiri\',\'OWNED\',\'POULTRY\',$4)', [farm, tenant, farmer, user]);
  await source.query('INSERT INTO "FarmMember" ("farmId","tenantId","userId",role) VALUES ($1,$2,$3,\'OWNER\')', [farm, tenant, user]);
  await source.query('INSERT INTO "VoiceExpenseDraft" (id,"tenantId","farmId","actorId","requestId",review,"payloadHash") VALUES ($1,$2,$3,$4,$5,$6,$7)', [draft, tenant, farm, user, request, review, hash]);
  await source.query('INSERT INTO "AccountingRecord" (id,"tenantId","farmId",kind,"categoryId","categoryName",amount,currency,"occurredOn","createdBy") VALUES ($1,$2,$3,\'EXPENSE\',$4,\'Feed\',180000,\'UGX\',\'2026-11-20\',$5)', [record, tenant, farm, category, user]);
  await source.query('UPDATE "VoiceExpenseDraft" SET "confirmedAt"=clock_timestamp(),"accountingRecordId"=$1 WHERE id=$2', [record, draft]);
  for (const action of ["ACCOUNTING_EXPENSE_RECORDED", "VOICE_EXPENSE_CONFIRMED"]) await source.query('INSERT INTO "AuditEvent" (id,"tenantId","actorId",action,"targetId","requestId") VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), tenant, user, action, action === "VOICE_EXPENSE_CONFIRMED" ? draft : record, request]);
  await source.query("COMMIT");
  const before = await snapshot(source);
  if (before.record[0]?.amount !== "180000.0000" || before.draft[0]?.payloadHash !== hash) throw new Error("Voice recovery fixture missing");
  const dump = pg("pg_dump", "myfarm_phase01_test", ["-Fc"]);
  await source.query('CREATE DATABASE "' + restoreName + '"'); created = true;
  pg("pg_restore", restoreName, ["--exit-on-error"], dump); await restored.connect(); connected = true;
  if (JSON.stringify(await snapshot(restored)) !== JSON.stringify(before)) throw new Error("Voice history, exact money, hash, receipt or grants changed in restore");
  const duplicate = await restored.query('INSERT INTO "AuditEvent" (id,"tenantId","actorId",action,"targetId","requestId") VALUES ($1,$2,$3,\'ACCOUNTING_EXPENSE_RECORDED\',$4,$5)', [randomUUID(), tenant, user, record, request]).then(() => "accepted", error => error.code);
  if (duplicate !== "23505") throw new Error("Restored receipt uniqueness failed");
  await restored.query("SET ROLE myfarm_runtime");
  const immutable = await restored.query('UPDATE "VoiceExpenseDraft" SET version=version+1 WHERE id=$1', [draft]).then(() => "accepted", error => error.code);
  await restored.query("RESET ROLE");
  if (immutable !== "23514") throw new Error("Restored completed draft was not immutable");
  console.log("PASS: actual dump/restore preserves one exact expense, actor/farm binding, review/hash/expiry, immutable confirmation, audit receipt uniqueness, RLS and runtime/browser grants.");
} finally {
  if (connected) await restored.end();
  if (created) await source.query('DROP DATABASE "' + restoreName + '"');
  await source.query("ROLLBACK"); await source.query("BEGIN");
  for (const table of ["VoiceExpenseDraft", "AccountingRecord", "AuditEvent", "FarmMember", "Farm", "Farmer"]) await source.query('DELETE FROM "' + table + '" WHERE "tenantId"=$1', [tenant]);
  await source.query('DELETE FROM "Membership" WHERE "userId"=$1', [user]);
  await source.query('DELETE FROM "Organization" WHERE id=$1', [tenant]); await source.query('DELETE FROM "User" WHERE id=$1', [user]);
  await source.query("COMMIT"); await source.end();
}
