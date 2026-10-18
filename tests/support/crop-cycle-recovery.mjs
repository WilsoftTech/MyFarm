// Explicit local-only rehearsal. Requires TEST_DATABASE_URL and MYFARM_TEST_CONTAINER.
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
const url = process.env.TEST_DATABASE_URL, container = process.env.MYFARM_TEST_CONTAINER;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url) || !container || !/^myfarm-t005-\d{8}$/.test(container)) throw new Error("Recovery rehearsal requires an explicit isolated T005 loopback database/container.");
const source = new Client({ connectionString: url });
const restoreName = "myfarm_t005_restore_" + randomUUID().replaceAll("-", "");
const dumpPath = "/tmp/" + restoreName + ".dump";
const restoredUrl = new URL(url); restoredUrl.pathname = "/" + restoreName;
const restored = new Client({ connectionString: restoredUrl.toString() });
const user = randomUUID(), tenant = randomUUID(), farmer = randomUUID(), farm = randomUUID(), plot = randomUUID(), enterprise = randomUUID(), season = randomUUID(), cycle = randomUUID(), request = randomUUID();
let created = false, connected = false;
const docker = args => execFileSync("docker", ["exec", container, ...args], { encoding: "utf8", stdio: "pipe" });
const snapshot = async db => (await db.query('SELECT to_jsonb(c) AS cycle, to_jsonb(a) AS audit FROM "CropCycle" c JOIN "AuditEvent" a ON a."targetId"=c.id WHERE c.id=$1 AND a."requestId"=$2', [cycle, request])).rows;
await source.connect();
try {
  await source.query("BEGIN");
  await source.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)', [user, randomUUID()]);
  await source.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Recovery fixture\',\'PERSONAL\')', [tenant]);
  await source.query('INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,\'FARMER\')', [user, tenant]);
  await source.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)', [farmer, user, tenant]);
  await source.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Recovery farm\',\'Rukungiri\',\'OWNED\',\'CROPS\',$4)', [farm, tenant, farmer, user]);
  await source.query('INSERT INTO "FarmMember" ("farmId","tenantId","userId",role) VALUES ($1,$2,$3,\'OWNER\')', [farm, tenant, user]);
  await source.query('INSERT INTO "Plot" (id,"tenantId","farmId",name,area,"areaUnit","createdBy") VALUES ($1,$2,$3,\'Recovery plot\',1,\'ACRE\',$4)', [plot, tenant, farm, user]);
  await source.query('INSERT INTO "Enterprise" (id,"tenantId","farmId",name,type,"createdBy") VALUES ($1,$2,$3,\'Recovery maize\',\'CROP\',$4)', [enterprise, tenant, farm, user]);
  await source.query('INSERT INTO "Season" (id,"tenantId","farmId",label,"startDate","createdBy") VALUES ($1,$2,$3,\'Recovery season\',\'2026-03-01\',$4)', [season, tenant, farm, user]);
  await source.query('INSERT INTO "CropCycle" (id,"tenantId","farmId","plotId","enterpriseId","seasonId","cropId","cropName","areaPlanted","areaUnit","plantingDate","areaExceptionReason","createdBy") VALUES ($1,$2,$3,$4,$5,$6,\'f4030005-0000-4000-8000-000000000001\',\'Maize\',1.000001,\'ACRE\',\'2026-03-01\',\'Recorded recovery overlap\',$7)', [cycle, tenant, farm, plot, enterprise, season, user]);
  await source.query('INSERT INTO "AuditEvent" (id,"actorId","tenantId",action,"targetId","requestId") VALUES ($1,$2,$3,\'CROP_CYCLE_STARTED\',$4,$5)', [randomUUID(), user, tenant, cycle, request]);
  await source.query("COMMIT");
  const before = await snapshot(source);
  if (before.length !== 1) throw new Error("Recovery fixture missing");
  docker(["pg_dump", "-U", "myfarm", "-d", "myfarm_phase01_test", "-Fc", "-f", dumpPath]);
  await source.query(`CREATE DATABASE "${restoreName}"`); created = true;
  docker(["pg_restore", "-U", "myfarm", "-d", restoreName, "--exit-on-error", dumpPath]);
  await restored.connect(); connected = true;
  if (JSON.stringify(await snapshot(restored)) !== JSON.stringify(before)) throw new Error("Restored crop/audit differs");
  const result = await restored.query("SELECT has_table_privilege('myfarm_runtime','public.\"CropCycle\"','SELECT') AS read, has_table_privilege('myfarm_runtime','public.\"CropCycle\"','UPDATE') AS update, has_table_privilege('authenticated','public.\"CropCycle\"','SELECT') AS browser");
  if (!result.rows[0].read || result.rows[0].update || result.rows[0].browser) throw new Error("Restored grants differ");
  console.log("PASS: dump/restore preserves exact crop area, exception reason, audit receipt and runtime/browser privilege boundaries.");
} finally {
  if (connected) await restored.end();
  if (created) await source.query(`DROP DATABASE "${restoreName}"`);
  await source.query("ROLLBACK");
  await source.query("BEGIN");
  for (const table of ["CropCycle", "AuditEvent", "Enterprise", "Season", "Plot", "FarmMember", "Farm", "Farmer"]) await source.query(`DELETE FROM "${table}" WHERE "tenantId"=$1`, [tenant]);
  await source.query('DELETE FROM "Membership" WHERE "userId"=$1', [user]);
  await source.query('DELETE FROM "Organization" WHERE id=$1', [tenant]);
  await source.query('DELETE FROM "User" WHERE id=$1', [user]);
  await source.query("COMMIT"); await source.end();
  // A generated single file in the disposable container, no recursive filesystem operation.
  docker(["rm", "-f", dumpPath]);
}
