import { defineConfig, devices } from "@playwright/test";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Production UI tests require an explicitly isolated loopback test database.");
const runtimeUrl = new URL(url); runtimeUrl.searchParams.set("options", "-c role=myfarm_runtime");
const secret = "synthetic-production-browser-secret";
process.env.MYFARM_BROWSER_AUTH_SECRET = secret;
export default defineConfig({
  testDir: "./tests/browser", fullyParallel: false, workers: 1,
  globalSetup: "./tests/support/production-browser-setup.ts",
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/production" }]],
  use: { baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure" },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: [
    { command: "node tests/support/production-auth-server.mjs", url: "http://127.0.0.1:3211/health", reuseExistingServer: false, env: { MYFARM_BROWSER_AUTH_SECRET: secret } },
    { command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102", url: "http://127.0.0.1:3102/api/health", reuseExistingServer: false, timeout: 60_000, env: {
      DATABASE_URL: runtimeUrl.toString(), NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3211", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
    } },
  ],
});
