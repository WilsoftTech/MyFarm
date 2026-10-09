import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { Client } from "pg";
import { config } from "dotenv";
import { applyProviderSql, catalogSnapshot, migrateDeploy, migrateStep, providerSqlFiles, runSqlFile, supabaseEmulation } from "../support/provisioning";
config({ path: ".env.test.local", quiet: true });
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Integration requires isolated local myfarm_phase01_test database.");

// Every test database here is new, local and dropped afterwards; the shared test database is never reprovisioned.
const admin = new Client({ connectionString: url });
const created: string[] = [];
const clients: Client[] = [];
async function freshDatabase(label: string) {
const name = `myfarm_provisioning_${label}_${randomBytes(4).toString("hex")}`;
await admin.query(`CREATE DATABASE ${name}`);
created.push(name);
const target = new URL(url!); target.pathname = "/" + name;
const client = new Client({ connectionString: target.toString() });
await client.connect(); clients.push(client);
await runSqlFile(client, supabaseEmulation);
return { url: target.toString(), client };
}
const rows = async (client: Client, sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows;
const BROWSER = ["anon", "authenticated"];
const LONG = 180_000;
let fresh: { url: string; client: Client };
let provisioned: string;

beforeAll(async () => {
await admin.connect();
fresh = await freshDatabase("fresh");
}, LONG);
afterAll(async () => {
await Promise.all(clients.map(c => c.end().catch(() => {})));
for (const name of created) await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
await admin.end();
}, LONG);

describe("provisioning order and transactions", () => {
it("runs migrations first and wraps every provider file in one transaction", () => {
expect(migrateStep).toBe("prisma migrate deploy");
expect(providerSqlFiles.at(-1)).toBe("supabase/policies/browser-role-lockdown.sql");
expect(providerSqlFiles.indexOf("supabase/policies/private-storage.sql")).toBeLessThan(providerSqlFiles.indexOf("supabase/policies/runtime-role.sql"));
for (const file of providerSqlFiles) {
const statements = readFileSync(file, "utf8").replace(/\r\n/g, "\n").split("\n").filter(line => line.trim() && !line.startsWith("--")).join("\n");
expect(statements, file).toMatch(/^BEGIN;\n[\s\S]+\nCOMMIT;$/);
expect(statements.match(/\b(BEGIN|COMMIT|ROLLBACK);/g), file).toEqual(["BEGIN;", "COMMIT;"]);
}
});

it("provisions a fresh database in the documented order, and a failing file leaves nothing behind", async () => {
expect(migrateDeploy(fresh.url)).toMatch(/All migrations have been successfully applied/);
for (const file of providerSqlFiles) {
const before = await catalogSnapshot(fresh.client);
await expect(runSqlFile(fresh.client, file, sql => sql.replace(/COMMIT;\s*$/, "SELECT 1/0;\nCOMMIT;\n")), file).rejects.toThrow(/division by zero/);
expect(await catalogSnapshot(fresh.client), file).toBe(before);
await runSqlFile(fresh.client, file);
}
provisioned = await catalogSnapshot(fresh.client);
}, LONG);
});

describe("browser-role privileges after provisioning", () => {
it("browser roles hold nothing on public objects, including _prisma_migrations", async () => {
expect(await rows(fresh.client, `SELECT c.relname, coalesce(r.rolname, 'PUBLIC') AS grantee FROM pg_class c
CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE c.relnamespace = 'public'::regnamespace AND (a.grantee = 0 OR r.rolname = ANY($1))`, [BROWSER])).toEqual([]);
for (const role of BROWSER) {
expect((await rows(fresh.client, `SELECT has_table_privilege($1, 'public._prisma_migrations', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS ok`, [role]))[0].ok).toBe(false);
}
expect(await rows(fresh.client, `SELECT relname FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
AND relname <> '_prisma_migrations' AND NOT relrowsecurity`)).toEqual([]);
});

it("no creator role's default privileges grant browser roles access; Supabase API behavior is kept", async () => {
expect(await rows(fresh.client, `SELECT pg_get_userbyid(d.defaclrole) AS creator, d.defaclobjtype FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) a JOIN pg_roles r ON r.oid = a.grantee
WHERE d.defaclnamespace IN (0, 'public'::regnamespace) AND r.rolname = ANY($1)`, [BROWSER])).toEqual([]);
// Kept on purpose: browser roles may still use the schema (Data API), and service_role keeps its defaults.
for (const role of BROWSER) expect((await rows(fresh.client, `SELECT has_schema_privilege($1, 'public', 'USAGE') AS ok`, [role]))[0].ok).toBe(true);
expect((await rows(fresh.client, `SELECT count(*)::int AS n FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
JOIN pg_roles r ON r.oid = a.grantee WHERE d.defaclnamespace = 'public'::regnamespace AND r.rolname = 'service_role'`))[0].n).toBeGreaterThan(0);
});

it("objects created later by any creator role (Phase 3 tables) give browser roles nothing", async () => {
const creators = (await rows(fresh.client, `SELECT DISTINCT pg_get_userbyid(defaclrole) AS role FROM pg_default_acl
WHERE defaclnamespace IN (0, 'public'::regnamespace) UNION SELECT current_user::text`)).map(r => r.role as string);
expect(creators).toEqual(expect.arrayContaining(["postgres", "supabase_admin"]));
await fresh.client.query("BEGIN");
try {
for (const [i, creator] of creators.entries()) {
await fresh.client.query(`GRANT CREATE ON SCHEMA public TO "${creator}"`);
await fresh.client.query(`SET LOCAL ROLE "${creator}"`);
await fresh.client.query(`CREATE TABLE public.probe_${i} (id uuid PRIMARY KEY); CREATE SEQUENCE public.probe_seq_${i};
CREATE FUNCTION public.probe_fn_${i}() RETURNS int LANGUAGE sql AS 'SELECT 1'`);
await fresh.client.query("RESET ROLE");
for (const role of BROWSER) {
const [privileges] = await rows(fresh.client, `SELECT has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') AS tbl,
has_sequence_privilege($1, $3, 'USAGE,SELECT,UPDATE') AS seq, has_function_privilege($1, $4, 'EXECUTE') AS fn`,
[role, `public.probe_${i}`, `public.probe_seq_${i}`, `public.probe_fn_${i}()`]);
expect(privileges, `${creator} → ${role}`).toEqual({ tbl: false, seq: false, fn: false });
}
}
} finally { await fresh.client.query("ROLLBACK"); }
});
});

describe("re-running and upgrading", () => {
it("re-running every step on the provisioned database changes nothing", async () => {
expect(migrateDeploy(fresh.url)).toMatch(/No pending migrations to apply/);
await applyProviderSql(fresh.client);
expect(await catalogSnapshot(fresh.client)).toBe(provisioned);
}, LONG);

it("upgrades a database provisioned before the lockdown (today's hosted dev state) to the same end state", async () => {
const previous = await freshDatabase("previous");
migrateDeploy(previous.url);
for (const file of providerSqlFiles.slice(0, -1)) await runSqlFile(previous.client, file);
for (const role of BROWSER) { // P2-C8 reproduced before the upgrade
expect((await rows(previous.client, `SELECT has_table_privilege($1, 'public._prisma_migrations', 'SELECT') AS ok`, [role]))[0].ok).toBe(true);
}
await applyProviderSql(previous.client);
expect(await catalogSnapshot(previous.client)).toBe(provisioned);
}, LONG);
});

describe("provisioned functions still work", () => {
const ids = { userA: randomUUID(), userB: randomUUID(), activeSession: randomUUID(), expiredSession: randomUUID(), appA: randomUUID(), appB: randomUUID(), orgA: randomUUID(), orgB: randomUUID() };
beforeAll(async () => {
const c = fresh.client;
await c.query(`INSERT INTO auth.users (id) VALUES ($1), ($2)`, [ids.userA, ids.userB]);
await c.query(`INSERT INTO auth.sessions (id, user_id, not_after) VALUES ($1, $2, NULL), ($3, $4, now() - interval '1 minute')`, [ids.activeSession, ids.userA, ids.expiredSession, ids.userB]);
await c.query(`INSERT INTO "User" (id, "authSubject") VALUES ($1, $2), ($3, $4)`, [ids.appA, ids.userA, ids.appB, ids.userB]);
await c.query(`INSERT INTO "Organization" (id, name, kind) VALUES ($1, 'A', 'PERSONAL'), ($2, 'B', 'PERSONAL')`, [ids.orgA, ids.orgB]);
await c.query(`INSERT INTO "Membership" ("userId", "organizationId", role) VALUES ($1, $2, 'FARMER'), ($3, $2, 'FARMER')`, [ids.appA, ids.orgA, ids.appB]);
});
const as = async <T>(role: string, claims: object | null, sql: string, params: unknown[] = []): Promise<T> => {
await fresh.client.query("BEGIN");
try {
if (claims) await fresh.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
await fresh.client.query(`SET LOCAL ROLE ${role}`);
return (await fresh.client.query(sql, params)).rows[0].v as T;
} finally { await fresh.client.query("ROLLBACK"); }
};

it("session check: runtime role only, active sessions only", async () => {
const check = `SELECT myfarm_private.myfarm_session_is_active($1, $2) AS v`;
expect(await as("myfarm_runtime", null, check, [ids.activeSession, ids.userA])).toBe(true);
expect(await as("myfarm_runtime", null, check, [ids.expiredSession, ids.userB])).toBe(false);
expect(await as("myfarm_runtime", null, check, [ids.activeSession, ids.userB])).toBe(false);
for (const role of BROWSER) await expect(as(role, null, check, [ids.activeSession, ids.userA])).rejects.toThrow(/permission denied/);
});

it("private storage grant: active session and active membership of the object's organization only", async () => {
const read = `SELECT myfarm_private.myfarm_can_read_storage($1) AS v`;
const claimsA = { sub: ids.userA, session_id: ids.activeSession };
expect(await as("authenticated", claimsA, read, [`${ids.orgA}/${randomUUID()}`])).toBe(true);
expect(await as("authenticated", claimsA, read, [`${ids.orgB}/${randomUUID()}`])).toBe(false);
expect(await as("authenticated", claimsA, read, [`${ids.orgA}/../${randomUUID()}`])).toBe(false);
expect(await as("authenticated", { sub: ids.userB, session_id: ids.expiredSession }, read, [`${ids.orgA}/${randomUUID()}`])).toBe(false);
await expect(as("anon", claimsA, read, [`${ids.orgA}/${randomUUID()}`])).rejects.toThrow(/permission denied/);
expect(await rows(fresh.client, `SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'`)).toEqual([{ policyname: "myfarm_scoped_private_read" }]);
expect(await rows(fresh.client, `SELECT public FROM storage.buckets WHERE id = 'myfarm-private'`)).toEqual([{ public: false }]);
});
});
