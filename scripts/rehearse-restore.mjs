import { config } from "dotenv";
import pg from "pg";
import { spawnSync } from "node:child_process";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@127\.0\.0\.1:55431\/myfarm_phase01_test$/.test(url)) throw new Error("Restore rehearsal requires the dedicated Phase1 local test container.");
const source = new pg.Client({ connectionString: url });
const destination = new pg.Client({ connectionString: url.replace("/myfarm_phase01_test", "/myfarm_phase01_restore") });
const docker = "C:/Program Files/Docker/Docker/resources/bin/docker.exe";
const container = "myfarm-phase01-verification";
function run(args) {
const result = spawnSync(docker, ["exec", container, ...args], { encoding: "utf8" });
if (result.status !== 0) throw new Error("Isolated container restore command failed: " + args[0]);
}
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const query = 'SELECT (SELECT count(*) FROM "User")::int AS users, (SELECT count(*) FROM "Organization")::int AS organizations, (SELECT count(*) FROM "Membership")::int AS memberships, (SELECT count(*) FROM "AuditEvent")::int AS audits';
await source.connect();
try {
await source.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,$2,$3)', [id,"Restore rehearsal synthetic","PERSONAL"]);
const before = (await source.query(query)).rows[0];
run(["pg_dump","--username=myfarm","--dbname=myfarm_phase01_test","--format=custom","--file=/tmp/myfarm-phase01.dump"]);
run(["createdb","--username=myfarm","myfarm_phase01_restore"]);
run(["pg_restore","--username=myfarm","--dbname=myfarm_phase01_restore","--no-owner","/tmp/myfarm-phase01.dump"]);
await destination.connect();
const after = (await destination.query(query)).rows[0];
if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Restored row counts differ.");
const stored = await destination.query('SELECT name FROM "Organization" WHERE id=$1',[id]);
if (stored.rows[0]?.name !== "Restore rehearsal synthetic") throw new Error("Synthetic backup record missing.");
const rls = await destination.query("SELECT bool_and(relrowsecurity) AS enabled FROM pg_class WHERE relname IN ('User','Organization','Membership','AuditEvent')");
if (!rls.rows[0]?.enabled) throw new Error("RLS not restored.");
console.log(JSON.stringify({ verdict:"PASS", sourceDatabase:"myfarm_phase01_test", restoredDatabase:"myfarm_phase01_restore", before, after, syntheticRecordRestored:true, rlsRestored:true }));
} finally {
await source.query('DELETE FROM "Organization" WHERE id=$1',[id]);
await source.end(); await destination.end();
}
