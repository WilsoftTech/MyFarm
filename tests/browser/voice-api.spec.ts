import { expect, test, type BrowserContext } from "../support/browser-test";
import { Client } from "pg";
import { idSchema } from "@/modules/engineering-foundation/contracts/identity";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
const origin = { origin: "http://127.0.0.1:3102" };
let fixtures: ProductionBrowserFixtures;
async function identity(context: BrowserContext, who: "a" | "b") {
  await context.clearCookies();
  await context.addCookies([{ name: "sb-127-auth-token", value: fixtures.accounts[who].cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax", secure: false }]);
}
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
test.beforeEach(async ({ context }) => { fixtures = readProductionBrowserFixtures(); await identity(context, "a"); });

test("a reviewed source expense needs explicit confirmation and replays one real financial record through the API", async ({ context }) => {
  const farmId = fixtures.farms.a, requestId = crypto.randomUUID(), root = `/api/v1/farms/${farmId}/voice/drafts`;
  const category = idSchema.parse((await query('SELECT id FROM "TransactionCategory" WHERE name = $1 AND kind = $2 AND active', ["Feed", "COST"])).rows[0]?.id);
  const body = { review: { schemaVersion: 1, kind: "EXPENSE", command: { requestId, categoryId: category, amount: "180000", currency: "UGX", occurredOn: "2026-11-19" }, bags: 2 } };
  const saved = await context.request.post(root, { headers: origin, data: body });
  expect(saved.status()).toBe(201); expect(saved.headers()["cache-control"]).toContain("no-store");
  const { draft } = await saved.json();
  expect(draft.review.command.amount).toBe("180000");
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId" = $1 AND action = $2', [requestId, "ACCOUNTING_EXPENSE_RECORDED"])).rows[0].n).toBe(0);
  const read = await context.request.get(root + "/" + draft.draftId);
  expect(read.status()).toBe(200); expect((await read.json()).draft).toEqual(draft);
  const confirmation = { requestId, confirmed: true, version: draft.version, payloadHash: draft.payloadHash };
  const path = root + "/" + draft.draftId + "/confirm";
  expect((await context.request.post(path, { headers: origin, data: { ...confirmation, confirmed: false } })).status()).toBe(400);
  expect((await context.request.post(path, { headers: origin, data: { ...confirmation, amount: "1" } })).status()).toBe(400);
  expect((await context.request.post(path, { headers: { origin: "https://attacker.example" }, data: confirmation })).status()).toBe(403);
  await identity(context, "b");
  expect((await context.request.post(path, { headers: origin, data: confirmation })).status()).toBe(403);
  expect((await context.request.get(`/api/v1/farms/${fixtures.farms.b}/voice/drafts/${draft.draftId}`)).status()).toBe(403);
  await identity(context, "a");
  const results = await Promise.all([context.request.post(path, { headers: origin, data: confirmation }), context.request.post(path, { headers: origin, data: confirmation })]);
  for (const response of results) expect(response.status()).toBe(201);
  const [a, b] = await Promise.all(results.map(response => response.json()));
  expect(b.receipt).toEqual(a.receipt);
  const rows = (await query('SELECT kind, amount::text, currency, "farmId" FROM "AccountingRecord" WHERE id = $1', [a.receipt.recordId])).rows;
  expect(rows).toEqual([{ kind: "EXPENSE", amount: "180000.0000", currency: "UGX", farmId }]);
  expect((await query('SELECT count(*)::int AS n FROM "AuditEvent" WHERE "requestId" = $1 AND action = $2', [requestId, "ACCOUNTING_EXPENSE_RECORDED"])).rows[0].n).toBe(1);
  expect((await context.request.post(path, { headers: origin, data: confirmation })).status()).toBe(201);
});
