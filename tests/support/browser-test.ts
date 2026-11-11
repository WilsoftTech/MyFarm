import { test as base } from "@playwright/test";
import { Client } from "pg";

export { expect } from "@playwright/test";
export type { BrowserContext, Page } from "@playwright/test";

// The signed-in suite reuses a few test users across every spec and both projects, so the
// per-person request limits (D-P09-014) would otherwise carry counts from one test into the
// next and refuse requests with 429 depending on how fast the machine is. Each test starts
// with a fresh allowance; the limits themselves are checked in tests/integration/request-limits.test.ts,
// tests/unit/request-limits.test.ts and the export-limit test in farm-export-ui.spec.ts.
export const test = base.extend<{ freshRequestAllowance: void }>({
  freshRequestAllowance: [async ({}, use) => {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
    try { await db.query('DELETE FROM "RequestCount"'); } finally { await db.end(); }
    await use();
  }, { auto: true }],
});
