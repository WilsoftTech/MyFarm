// Explicit local-only rehearsal. Requires TEST_DATABASE_URL and MYFARM_TEST_CONTAINER.
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
const url = process.env.TEST_DATABASE_URL, container = process.env.MYFARM_TEST_CONTAINER;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url) || !container || !/^myfarm-t\d{3}-\d{8}$/.test(container)) throw new Error("Recovery rehearsal requires an explicit isolated loopback database/disposable task container.");
const source = new Client({ connectionString: url });
const restoreName = "myfarm_p04_t002_restore_" + randomUUID().replaceAll("-", "");
const dumpPath = "/tmp/" + restoreName + ".dump";
const restoredUrl = new URL(url); restoredUrl.pathname = "/" + restoreName;
const restored = new Client({ connectionString: restoredUrl.toString() });
const user = randomUUID(), tenant = randomUUID(), farmer = randomUUID(), farm = randomUUID();
const sale = randomUUID(), expense = randomUUID(), payment = randomUUID(), reversal = randomUUID(), request = randomUUID();
let created = false, connected = false;
const docker = args => execFileSync("docker", ["exec", container, ...args], { encoding: "utf8", stdio: "pipe" });
const snapshot = async db => (await db.query(`SELECT
  (SELECT json_agg(json_build_object('id', r.id, 'kind', r.kind, 'amount', r.amount::text, 'currency', r.currency, 'status', r.status, 'version', r.version) ORDER BY r.id) FROM "AccountingRecord" r WHERE r."tenantId" = $1) AS records,
  (SELECT json_agg(json_build_object('payment', a."paymentId", 'obligation', a."obligationId", 'amount', a.amount::text)) FROM "PaymentAllocation" a WHERE a."tenantId" = $1) AS allocations,
  (SELECT (o.amount - COALESCE(sum(a.amount) FILTER (WHERE p.status = 'POSTED'), 0))::text FROM "AccountingRecord" o LEFT JOIN "PaymentAllocation" a ON a."obligationId" = o.id LEFT JOIN "PaymentRecord" p ON p.id = a."paymentId" WHERE o.id = $2 GROUP BY o.amount) AS outstanding,
  (SELECT json_agg(json_build_object('record', v."recordId", 'reason', v.reason)) FROM "AccountingReversal" v WHERE v."tenantId" = $1) AS reversals,
  (SELECT count(*)::int FROM "AuditEvent" WHERE "requestId" = $3) AS audits`, [tenant, sale, request])).rows;
await source.connect();
try {
  await source.query("BEGIN");
  await source.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [user, randomUUID()]);
  await source.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Recovery fixture\',\'PERSONAL\')', [tenant]);
  await source.query('INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,\'FARMER\')', [user, tenant]);
  await source.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)', [farmer, user, tenant]);
  await source.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Recovery farm\',\'Rukungiri\',\'OWNED\',\'CROPS\',$4)', [farm, tenant, farmer, user]);
  await source.query('INSERT INTO "FarmMember" ("farmId","tenantId","userId",role) VALUES ($1,$2,$3,\'OWNER\')', [farm, tenant, user]);
  const insertRecord = 'INSERT INTO "AccountingRecord" (id,"tenantId","farmId",kind,"categoryId","categoryName",amount,currency,"occurredOn","paymentMethodId",status,version,"createdBy") VALUES ($1,$2,$3,$4,$5,$6,$7,\'UGX\',\'2027-06-01\',$8,$9,$10,$11)';
  await source.query(insertRecord, [sale, tenant, farm, "SALE", "f4040002-0000-4000-8000-000000000204", "Crop sales", "200000", null, "POSTED", 1, user]);
  await source.query(insertRecord, [expense, tenant, farm, "EXPENSE", "f4040002-0000-4000-8000-000000000111", "Fertilizer", "9999999999999999.9999", "f4040002-0000-4000-8000-000000000302", "REVERSED", 2, user]);
  await source.query('INSERT INTO "PaymentRecord" (id,"tenantId","farmId",direction,amount,currency,"paidOn","paymentMethodId","createdBy") VALUES ($1,$2,$3,\'RECEIVED\',\'80000\',\'UGX\',\'2027-06-05\',\'f4040002-0000-4000-8000-000000000302\',$4)', [payment, tenant, farm, user]);
  await source.query('INSERT INTO "PaymentAllocation" (id,"tenantId","farmId","paymentId","obligationId",amount) VALUES ($1,$2,$3,$4,$5,\'80000\')', [randomUUID(), tenant, farm, payment, sale]);
  await source.query('INSERT INTO "AccountingReversal" (id,"tenantId","farmId","recordId",reason,"createdBy") VALUES ($1,$2,$3,$4,\'Entered twice\',$5)', [reversal, tenant, farm, expense, user]);
  await source.query('INSERT INTO "AuditEvent" (id,"actorId","tenantId",action,"targetId","requestId") VALUES ($1,$2,$3,\'ACCOUNTING_SALE_RECORDED\',$4,$5)', [randomUUID(), user, tenant, sale, request]);
  await source.query("COMMIT");
  const before = await snapshot(source);
  if (before[0].outstanding !== "120000.0000" || before[0].audits !== 1) throw new Error("Recovery fixture missing");
  docker(["pg_dump", "-U", "myfarm", "-d", "myfarm_phase01_test", "-Fc", "-f", dumpPath]);
  await source.query(`CREATE DATABASE "${restoreName}"`); created = true;
  docker(["pg_restore", "-U", "myfarm", "-d", restoreName, "--exit-on-error", dumpPath]);
  await restored.connect(); connected = true;
  if (JSON.stringify(await snapshot(restored)) !== JSON.stringify(before)) throw new Error("Restored accounting history differs");
  const catalogs = await restored.query('SELECT (SELECT count(*)::int FROM "TransactionCategory") AS categories, (SELECT json_agg(name ORDER BY "createdAt" DESC, id DESC) FROM "PaymentMethod") AS methods');
  if (catalogs.rows[0].categories < 17 || JSON.stringify(catalogs.rows[0].methods) !== JSON.stringify(["Cash", "Mobile Money", "Bank transfer"])) throw new Error("Restored catalogs differ");
  const twice = await restored.query('INSERT INTO "AccountingReversal" (id,"tenantId","farmId","recordId",reason,"createdBy") VALUES ($1,$2,$3,$4,\'Again\',$5)', [randomUUID(), tenant, farm, expense, user]).then(() => "inserted", error => error.code);
  if (twice !== "23505") throw new Error("Restored single-reversal rule differs: " + twice);
  const zero = await restored.query('INSERT INTO "PaymentAllocation" (id,"tenantId","farmId","paymentId","obligationId",amount) VALUES ($1,$2,$3,$4,$5,0)', [randomUUID(), tenant, farm, randomUUID(), sale]).then(() => "inserted", error => error.code);
  if (zero !== "23514" && zero !== "23503") throw new Error("Restored allocation checks differ: " + zero);
  const grants = await restored.query(`SELECT has_table_privilege('myfarm_runtime','public."AccountingRecord"','INSERT') AS insert,
    has_table_privilege('myfarm_runtime','public."AccountingRecord"','DELETE') AS delete,
    has_column_privilege('myfarm_runtime','public."AccountingRecord"','amount','UPDATE') AS amount_update,
    has_column_privilege('myfarm_runtime','public."AccountingRecord"','status','UPDATE') AS status_update,
    has_table_privilege('myfarm_runtime','public."TransactionCategory"','INSERT') AS catalog_insert,
    has_table_privilege('authenticated','public."AccountingRecord"','SELECT') AS browser`);
  if (JSON.stringify(grants.rows[0]) !== JSON.stringify({ insert: true, delete: false, amount_update: false, status_update: true, catalog_insert: false, browser: false })) throw new Error("Restored grants differ: " + JSON.stringify(grants.rows[0]));
  console.log("PASS: dump/restore preserves exact amounts (including the numeric(20,4) maximum), derived UGX 120,000 due, reversal history and single-reversal rule, audit receipt, catalogs and runtime/browser privilege boundaries.");
} finally {
  if (connected) await restored.end();
  if (created) await source.query(`DROP DATABASE "${restoreName}"`);
  await source.query("ROLLBACK");
  await source.query("BEGIN");
  for (const table of ["AccountingReversal", "PaymentAllocation", "PaymentRecord", "AccountingRecord", "AuditEvent", "FarmMember", "Farm", "Farmer"]) await source.query(`DELETE FROM "${table}" WHERE "tenantId"=$1`, [tenant]);
  await source.query('DELETE FROM "Membership" WHERE "userId"=$1', [user]);
  await source.query('DELETE FROM "Organization" WHERE id=$1', [tenant]);
  await source.query('DELETE FROM "User" WHERE id=$1', [user]);
  await source.query("COMMIT"); await source.end();
  // A generated single file in the disposable container, no recursive filesystem operation.
  docker(["rm", "-f", dumpPath]);
}
