import { openSync, closeSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const directory = "D:/Myfarm/.cache/phase12-complete/final";
mkdirSync(directory, { recursive: true });
const databaseUrl = "postgresql://myfarm:isolated-ci-password@127.0.0.1:55479/myfarm_phase01_test";
const env = { ...process.env, TEST_DATABASE_URL: databaseUrl, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, MYFARM_TEST_CONTAINER: "myfarm-voice-20261119", NEXT_TELEMETRY_DISABLED: "1" };
const commands = [
  ["lint", "npm run lint"], ["typecheck", "npm run typecheck"], ["boundaries", "npm run check:boundaries"],
  ["unit-component", "npm test"], ["migrate", "npm run db:migrate"], ["integration", "npm run test:integration"],
  ["non-utc", "npm run test:integration -- tests/integration/voice-drafts.test.ts tests/integration/voice-input.test.ts tests/integration/farm-accounting-service.test.ts", { TZ: "Africa/Nairobi" }],
  ["drift", "node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code"],
  ["stock-recovery", "node tests/support/phase05-recovery.mjs"], ["activity-recovery", "node tests/support/phase06-recovery.mjs"], ["voice-recovery", "node tests/support/phase12-recovery.mjs"],
  ["production-audit", "npm audit --omit=dev --json"], ["build", "npm run build"],
  ["anonymous-browser", "npm run test:e2e -- --reporter=line"],
  ["fixture-build", "npm run build", { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3211", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key" }],
  ["signed-in-browser", "npm run test:e2e -- --config playwright.production.config.ts --reporter=line"],
  ["diff", "git diff --check"],
];
commands.splice(0, commands.length, ["final-lint","npm run lint"], ["final-typecheck","npm run typecheck"], ["final-voice-component","npm test -- tests/component/voice-expense.test.tsx"]);
const start = process.argv[2] ? commands.findIndex(([name]) => name === process.argv[2]) : 0;
if (start < 0) throw new Error("Unknown verification checkpoint");
const selected = commands.slice(start);
const records = true ? JSON.parse(readFileSync(directory + "/checks.json", "utf8")).filter(record => !selected.some(([name]) => name === record.name)) : [];
for (const [name, command, overrides = {}] of selected) {
  const file = directory + "/" + name + ".log";
  writeFileSync(file, "$ " + command + "\n");
  const fd = openSync(file, "a");
  console.log("CHECK " + name);
  const startedAt = new Date().toISOString();
  const result = spawnSync(process.env.ComSpec, ["/d", "/s", "/c", command], { cwd: "D:/Myfarm", env: { ...env, ...overrides }, stdio: ["ignore", fd, fd], timeout: 3600000 });
  closeSync(fd);
  const record = { name, command, startedAt, exitCode: result.status, signal: result.signal, error: result.error?.message ?? null };
  records.push(record); writeFileSync(directory + "/checks.json", JSON.stringify(records, null, 2));
  console.log(JSON.stringify(record));
  if (result.status !== 0) { console.log(readFileSync(file, "utf8").slice(-7000)); process.exit(1); }
}
console.log("ALL CHECKS PASS");
