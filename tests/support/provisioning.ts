import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import type { Client } from "pg";

// Test helpers that execute the real provisioning files listed in supabase/provisioning.json.
export const supabaseEmulation = "tests/support/supabase-emulation.sql";
const steps: string[] = JSON.parse(readFileSync("supabase/provisioning.json", "utf8")).steps;
export const migrateStep = steps[0];
export const providerSqlFiles = steps.slice(1);

export async function runSqlFile(client: Client, path: string, transform: (sql: string) => string = sql => sql) {
try { await client.query(transform(readFileSync(path, "utf8"))); }
catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
}

export async function applyProviderSql(client: Client) {
for (const file of providerSqlFiles) await runSqlFile(client, file);
}

// `prisma migrate deploy` against an explicit database, without a shell (Windows-safe).
export function migrateDeploy(databaseUrl: string) {
return execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl }, encoding: "utf8", stdio: "pipe",
});
}

// Name-based catalog state that provisioning controls: comparable across databases and runs.
export async function catalogSnapshot(client: Client) {
const query = async (sql: string) => (await client.query(sql)).rows;
return JSON.stringify({
policies: await query(`SELECT schemaname, tablename, policyname, cmd, roles::text, qual, with_check FROM pg_policies
WHERE schemaname IN ('public', 'storage') ORDER BY 1, 2, 3`),
relationAcl: await query(`SELECT n.nspname, c.relname, c.relkind, c.relrowsecurity,
CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE r.rolname END AS grantee, a.privilege_type
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN LATERAL aclexplode(c.relacl) a ON true LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname IN ('public', 'myfarm_private', 'storage') AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S') ORDER BY 1, 2, 5, 6`),
columnAcl: await query(`SELECT c.relname, at.attname, r.rolname, a.privilege_type
FROM pg_attribute at JOIN pg_class c ON c.oid = at.attrelid CROSS JOIN LATERAL aclexplode(at.attacl) a JOIN pg_roles r ON r.oid = a.grantee
WHERE c.relnamespace = 'public'::regnamespace ORDER BY 1, 2, 3, 4`),
functions: await query(`SELECT n.nspname, p.oid::regprocedure::text AS signature, p.prosecdef, p.proconfig::text, md5(p.prosrc) AS body,
coalesce(r.rolname, 'PUBLIC') AS grantee, a.privilege_type
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a ON true LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname IN ('public', 'myfarm_private') ORDER BY 1, 2, 6, 7`),
schemaAcl: await query(`SELECT n.nspname, coalesce(r.rolname, 'PUBLIC') AS grantee, a.privilege_type
FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a LEFT JOIN pg_roles r ON r.oid = a.grantee
WHERE n.nspname IN ('public', 'myfarm_private') ORDER BY 1, 2, 3`),
defaultAcl: await query(`SELECT pg_get_userbyid(d.defaclrole) AS creator, coalesce(n.nspname, '<global>') AS schema, d.defaclobjtype,
coalesce(r.rolname, 'PUBLIC') AS grantee, a.privilege_type
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
CROSS JOIN LATERAL aclexplode(d.defaclacl) a LEFT JOIN pg_roles r ON r.oid = a.grantee ORDER BY 1, 2, 3, 4, 5`),
buckets: await query(`SELECT id, name, public, file_size_limit::text FROM storage.buckets ORDER BY id`),
});
}
