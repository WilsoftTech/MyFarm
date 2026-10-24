import { readFileSync } from "node:fs";
import { z } from "zod";
const actors = z.object({ a: z.uuid(), b: z.uuid(), admin: z.uuid() });
const farmers = z.object({ a: z.uuid(), b: z.uuid() });
const account = z.object({ subject: z.uuid(), email: z.email(), cookie: z.string().min(1) });
const fixtures = z.object({ users: actors, subjects: actors, sessions: actors, tenants: farmers, farmers,
  farms: z.object({ a: z.uuid(), a2: z.uuid(), b: z.uuid() }), accounts: z.object({ a: account, b: account, admin: account }),
});
export type ProductionBrowserFixtures = z.output<typeof fixtures>;
export function readProductionBrowserFixtures() { return fixtures.parse(JSON.parse(readFileSync(".cache/production-browser-fixtures.json", "utf8"))); }
