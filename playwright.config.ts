import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
testDir: "./tests/e2e", fullyParallel: true, reporter: [["list"], ["html", { open: "never" }]],
use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3101", url: "http://127.0.0.1:3101/api/health", reuseExistingServer: false, timeout: 60000, env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key" } },
});
