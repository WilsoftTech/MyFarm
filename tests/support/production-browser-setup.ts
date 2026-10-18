import { createHmac, randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { applyProviderSql, migrateDeploy, runSqlFile, supabaseEmulation } from "./provisioning";
import type { ProductionBrowserFixtures } from "./production-browser-fixtures";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL, secret = process.env.MYFARM_BROWSER_AUTH_SECRET;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url) || !secret) throw new Error("Browser acceptance requires isolated loopback test database and fixture Auth secret.");
  migrateDeploy(url);
  const db = new Client({ connectionString: url }); await db.connect();
  const users = { a: randomUUID(), b: randomUUID(), admin: randomUUID() }, subjects = { a: randomUUID(), b: randomUUID(), admin: randomUUID() };
  const sessions = { a: randomUUID(), b: randomUUID(), admin: randomUUID() }, tenants = { a: randomUUID(), b: randomUUID() }, farmers = { a: randomUUID(), b: randomUUID() };
  const farms = { a: randomUUID(), a2: randomUUID(), b: randomUUID() };
  const token = (who: keyof typeof users) => {
    const now = Math.floor(Date.now() / 1000), exp = now + 3600;
    const user = { id: subjects[who], aud: "authenticated", role: "authenticated", email: `fixture-${who}@example.test`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: subjects[who], session_id: sessions[who], aud: "authenticated", role: "authenticated", iat: now, exp })).toString("base64url");
    const access_token = header + "." + payload + "." + createHmac("sha256", secret).update(header + "." + payload).digest("base64url");
    const cookie = "base64-" + Buffer.from(JSON.stringify({ access_token, refresh_token: "test-only-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: exp, user })).toString("base64url");
    return { subject: subjects[who], email: user.email, cookie };
  };
  const fixtures: ProductionBrowserFixtures = { users, subjects, sessions, tenants, farmers, farms, accounts: { a: token("a"), b: token("b"), admin: token("admin") } };
  try {
    await runSqlFile(db, supabaseEmulation); await applyProviderSql(db);
    await db.query("BEGIN");
    for (const who of ["a", "b", "admin"] as const) {
      await db.query('INSERT INTO auth.users (id) VALUES ($1)', [subjects[who]]);
      await db.query('INSERT INTO auth.sessions (id, user_id) VALUES ($1, $2)', [sessions[who], subjects[who]]);
      await db.query('INSERT INTO "User" (id, "authSubject") VALUES ($1, $2)', [users[who], subjects[who]]);
    }
    for (const who of ["a", "b"] as const) {
      await db.query('INSERT INTO "Organization" (id, name, kind) VALUES ($1, $2, \'PERSONAL\')', [tenants[who], "Browser fixture " + who]);
      await db.query('INSERT INTO "Membership" ("userId", "organizationId", role) VALUES ($1, $2, \'FARMER\')', [users[who], tenants[who]]);
      await db.query('INSERT INTO "Farmer" (id, "userId", "tenantId") VALUES ($1, $2, $3)', [farmers[who], users[who], tenants[who]]);
      await db.query('INSERT INTO "FarmerProfile" ("farmerId", name, phone, district, "preferredLanguage", "ownershipType", "mainActivities", "updatedBy") VALUES ($1, $2, $3, $4, \'en\', \'OWNED\', ARRAY[\'CROPS\',\'POULTRY\']::"FarmActivity"[], $5)', [farmers[who], "Browser farmer " + who, "+256700000000", "Rukungiri", users[who]]);
    }
    for (const key of ["a", "a2", "b"] as const) {
      const who = key === "b" ? "b" : "a";
      await db.query('INSERT INTO "Farm" (id, "tenantId", "ownerFarmerId", name, district, "ownershipType", "primaryActivity", "createdBy") VALUES ($1, $2, $3, $4, $5, \'OWNED\', \'CROPS\', $6)', [farms[key], tenants[who], farmers[who], "Browser farm " + key.toUpperCase(), "Rukungiri", users[who]]);
      await db.query('INSERT INTO "FarmMember" ("farmId", "userId", "tenantId", role) VALUES ($1, $2, $3, \'OWNER\')', [farms[key], users[who], tenants[who]]);
    }
    await db.query('INSERT INTO "Membership" ("userId", "organizationId", role) VALUES ($1, $2, \'ADMIN\')', [users.admin, tenants.a]);
    await db.query('INSERT INTO "FarmMember" ("farmId", "userId", "tenantId", role) VALUES ($1, $2, $3, \'OWNER\')', [farms.a, users.admin, tenants.a]);
    await db.query("COMMIT");
    mkdirSync(".cache", { recursive: true });
    writeFileSync(".cache/production-browser-fixtures.json", JSON.stringify(fixtures));
  } catch (error) { await db.query("ROLLBACK"); throw error; }
  finally { await db.end(); }

  return async () => {
    const cleanup = new Client({ connectionString: url }); await cleanup.connect();
    try {
      await cleanup.query("BEGIN");
      for (const table of ["Enterprise", "Season", "Plot", "FarmMember", "Farm"]) await cleanup.query(`DELETE FROM "${table}" WHERE "tenantId" = ANY($1::uuid[])`, [Object.values(tenants)]);
      await cleanup.query('DELETE FROM "AuditEvent" WHERE "actorId" = ANY($1::uuid[])', [Object.values(users)]);
      await cleanup.query('DELETE FROM "FarmerProfile" WHERE "farmerId" = ANY($1::uuid[])', [Object.values(farmers)]);
      await cleanup.query('DELETE FROM "Farmer" WHERE id = ANY($1::uuid[])', [Object.values(farmers)]);
      await cleanup.query('DELETE FROM "Membership" WHERE "userId" = ANY($1::uuid[])', [Object.values(users)]);
      await cleanup.query('DELETE FROM "Organization" WHERE id = ANY($1::uuid[])', [Object.values(tenants)]);
      await cleanup.query('DELETE FROM "User" WHERE id = ANY($1::uuid[])', [Object.values(users)]);
      await cleanup.query('DELETE FROM auth.sessions WHERE id = ANY($1::uuid[])', [Object.values(sessions)]);
      await cleanup.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [Object.values(subjects)]);
      await cleanup.query("COMMIT");
      unlinkSync(".cache/production-browser-fixtures.json");
    } catch (error) { await cleanup.query("ROLLBACK"); throw error; }
    finally { await cleanup.end(); }
  };
}
