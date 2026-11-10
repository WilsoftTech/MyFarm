import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { inventoryFixture } from "../support/inventory-fixture";
import { requestLimits } from "@/modules/engineering-foundation/infrastructure/request-limits";
import { REQUEST_LIMITS } from "@/modules/engineering-foundation/domain/request-limits";

const id = () => crypto.randomUUID();

it("the request-limit migration rolls back atomically and only adds one table, with row security on", async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Isolated loopback database required");
  const admin = new Client({ connectionString: url }); await admin.connect();
  const name = "myfarm_limits_upgrade_" + crypto.randomUUID().replaceAll("-", "");
  const target = new URL(url); target.pathname = "/" + name;
  await admin.query('CREATE DATABASE "' + name + '"');
  const db = new Client({ connectionString: target.toString() }); await db.connect();
  try {
    const release = "202611100002_request_limits";
    for (const part of readdirSync("prisma/migrations").filter(p => /^\d/.test(p) && p < release).sort()) await db.query(readFileSync("prisma/migrations/" + part + "/migration.sql", "utf8"));
    const tables = async () => (await db.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`)).rows[0].n;
    const before = await tables();
    const sql = readFileSync("prisma/migrations/" + release + "/migration.sql", "utf8");
    await expect(db.query(sql.replace(/COMMIT;\s*$/, "SELECT 1/0; COMMIT;"))).rejects.toMatchObject({ code: "22012" });
    await db.query("ROLLBACK");
    expect(await tables()).toBe(before);
    await db.query(sql);
    expect(await tables()).toBe(before + 1);
    expect((await db.query(`SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public."RequestCount"'::regclass`)).rows[0].rls).toBe(true);
  } finally { await db.end(); await admin.query('DROP DATABASE "' + name + '"'); await admin.end(); }
}, 60_000);

describe("request limits under the restricted runtime role (D-P09-014)", () => {
  let f: Awaited<ReturnType<typeof inventoryFixture>>;
  const subjects: string[] = [];
  const person = () => { const subject = id(); subjects.push(subject); return subject; };
  const limits = () => requestLimits(f.runtime);
  // The owner connection writes old counts directly, standing in for time passing.
  const backdate = (subject: string, action: string, ages: string[]) => Promise.all(ages.map(age =>
    f.owner.$executeRawUnsafe(`INSERT INTO "RequestCount" (id, subject, action, "occurredAt") VALUES (gen_random_uuid(), $1::uuid, $2, clock_timestamp() - $3::interval)`, subject, action, age)));
  const count = async (subject: string, action?: string) => Number((await f.owner.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "RequestCount" WHERE subject = $1::uuid` + (action ? ` AND action = $2` : ""), ...(action ? [subject, action] : [subject])))[0].n);
  beforeAll(async () => { f = await inventoryFixture(); }, 60_000);
  afterAll(async () => {
    await f.owner.$executeRawUnsafe(`DELETE FROM "RequestCount" WHERE subject = ANY($1::uuid[])`, subjects);
    await f.cleanup();
  });

  it("allows exactly the limit in the window, then refuses without counting the refusal", async () => {
    const subject = person();
    for (let i = 0; i < REQUEST_LIMITS.SYNC_PUSH[0].max; i++) expect(await limits().take(subject, "SYNC_PUSH", null)).toBe(true);
    expect(await limits().take(subject, "SYNC_PUSH", null)).toBe(false);
    expect(await count(subject)).toBe(30);
  });

  it("a retry carrying a counted key is free, even at the limit; a new key is not", async () => {
    const subject = person(), key = id();
    expect(await limits().take(subject, "MONEY_EXPORT", key)).toBe(true);
    for (let i = 0; i < 9; i++) expect(await limits().take(subject, "MONEY_EXPORT", null)).toBe(true);
    expect(await limits().take(subject, "MONEY_EXPORT", key)).toBe(true);
    expect(await limits().take(subject, "MONEY_EXPORT", id())).toBe(false);
    expect(await count(subject)).toBe(10);
  });

  it("two people, and two kinds of request, never share a count", async () => {
    const one = person(), two = person();
    for (let i = 0; i < 3; i++) await limits().take(one, "FARM_EXPORT", null);
    expect(await limits().take(one, "FARM_EXPORT", null)).toBe(false);
    expect(await limits().take(two, "FARM_EXPORT", null)).toBe(true);
    expect(await limits().take(one, "MONEY_EXPORT", null)).toBe(true);
  });

  it("every window must have room: photos are 30 an hour and 200 a day", async () => {
    const hourly = person();
    await backdate(hourly, "PHOTO_UPLOAD", Array.from({ length: 30 }, () => "10 minutes"));
    expect(await limits().take(hourly, "PHOTO_UPLOAD", null)).toBe(false);
    const daily = person();
    await backdate(daily, "PHOTO_UPLOAD", Array.from({ length: 200 }, () => "2 hours"));
    expect(await limits().take(daily, "PHOTO_UPLOAD", null)).toBe(false);
    const rested = person();
    await backdate(rested, "PHOTO_UPLOAD", Array.from({ length: 199 }, () => "2 hours"));
    expect(await limits().take(rested, "PHOTO_UPLOAD", null)).toBe(true);
  });

  it("counts fall out of the window on the database clock", async () => {
    const subject = person();
    await backdate(subject, "SAVE", Array.from({ length: 120 }, () => "61 seconds"));
    expect(await limits().take(subject, "SAVE", null)).toBe(true);
    await backdate(subject, "SAVE", Array.from({ length: 119 }, () => "30 seconds"));
    expect(await limits().take(subject, "SAVE", null)).toBe(false);
  });

  it("a check alone counts nothing, and a reused key gives no way round a check", async () => {
    const subject = person(), key = id();
    for (let i = 0; i < 5; i++) await limits().note(subject, "PILOT_JOIN_REFUSED", i === 0 ? key : id());
    await limits().note(subject, "PILOT_JOIN_REFUSED", key);
    expect(await count(subject)).toBe(5);
    expect(await limits().allowed(subject, "PILOT_JOIN_REFUSED")).toBe(false);
    expect(await count(subject)).toBe(5);
    const fresh = person();
    expect(await limits().allowed(fresh, "PILOT_JOIN_REFUSED")).toBe(true);
    expect(await count(fresh)).toBe(0);
  });

  it("removes counts older than a day as people make requests, and never newer ones", async () => {
    const old = person(), recent = person();
    await backdate(old, "SAVE", ["25 hours", "26 hours"]);
    await backdate(recent, "SAVE", ["23 hours"]);
    await limits().take(person(), "SAVE", null);
    expect(await count(old)).toBe(0);
    expect(await count(recent)).toBe(1);
  });

  it("concurrent requests from one person cannot overshoot the limit", async () => {
    const subject = person();
    const results = await Promise.all(Array.from({ length: 8 }, () => limits().take(subject, "FARM_EXPORT", null)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await count(subject)).toBe(3);
  });

  it("the app's role can add counts and remove only old ones; it cannot change or backdate them, and browsers have no access", async () => {
    const subject = person();
    await limits().take(subject, "SAVE", null);
    expect(await f.runtime.$executeRawUnsafe(`DELETE FROM "RequestCount" WHERE subject = $1::uuid`, subject)).toBe(0);
    await expect(f.runtime.$executeRawUnsafe(`UPDATE "RequestCount" SET action = 'X' WHERE subject = $1::uuid`, subject)).rejects.toThrow(/permission denied/);
    await expect(f.runtime.$executeRawUnsafe(`INSERT INTO "RequestCount" (id, subject, action, "occurredAt") VALUES (gen_random_uuid(), $1::uuid, 'SAVE', now() - interval '2 hours')`, subject)).rejects.toThrow(/row-level security/);
    await expect(f.runtime.$executeRawUnsafe(`TRUNCATE "RequestCount"`)).rejects.toThrow(/permission denied/);
    const [grants] = await f.owner.$queryRawUnsafe<{ anon: boolean; authenticated: boolean; fn: boolean }[]>(`SELECT
      has_table_privilege('anon', 'public."RequestCount"', 'SELECT,INSERT,UPDATE,DELETE') AS anon,
      has_table_privilege('authenticated', 'public."RequestCount"', 'SELECT,INSERT,UPDATE,DELETE') AS authenticated,
      has_function_privilege('authenticated', 'myfarm_private.myfarm_take_request(uuid, text, text, integer[], integer[], boolean)', 'EXECUTE') AS fn`);
    expect(grants).toEqual({ anon: false, authenticated: false, fn: false });
  });

  it("refuses a malformed limit instead of allowing everything", async () => {
    await expect(f.runtime.$queryRawUnsafe(`SELECT myfarm_private.myfarm_take_request($1::uuid, 'SAVE', NULL, ARRAY[1, 2], ARRAY[60], true)`, id())).rejects.toThrow(/invalid request limit/);
    await expect(f.runtime.$queryRawUnsafe(`SELECT myfarm_private.myfarm_take_request($1::uuid, 'SAVE', NULL, ARRAY[]::integer[], ARRAY[]::integer[], true)`, id())).rejects.toThrow(/invalid request limit/);
  });
});
