import { expect, test } from "@playwright/test";
const scope = "11111111-1111-4111-8111-111111111111", cohort = "22222222-2222-4222-8222-222222222222", record = "33333333-3333-4333-8333-333333333333";
const origin = { origin: "http://127.0.0.1:3101" };

test("pilot pages send anonymous users to sign-in before showing anything (P09-T003)", async ({ page, request }) => {
  for (const path of ["/pilot", "/admin/pilot?scope=" + scope, "/admin/pilot/" + cohort + "?scope=" + scope]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("pilot API routes deny anonymous callers and cross-origin writes without leaking data", async ({ request }) => {
  for (const path of ["/api/v1/pilot/participations", `/api/v1/scopes/${scope}/pilot/cohorts`, `/api/v1/scopes/${scope}/pilot/cohorts/${cohort}`]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toMatchObject({ error: "UNAUTHENTICATED" });
  }
  const writes = ["/api/v1/pilot/participations", `/api/v1/pilot/participations/${record}/withdraw`, `/api/v1/scopes/${scope}/pilot/cohorts`, `/api/v1/scopes/${scope}/pilot/cohorts/${cohort}/prompts`, `/api/v1/scopes/${scope}/pilot/cohorts/${cohort}/incidents`, `/api/v1/scopes/${scope}/pilot/cohorts/${cohort}/incidents/${record}/resolve`, `/api/v1/scopes/${scope}/pilot/cohorts/${cohort}/participations/${record}/paper-consent`];
  for (const path of writes) {
    expect((await request.post(path, { headers: origin, data: { requestId: record } })).status()).toBe(401);
    expect((await request.post(path, { headers: { origin: "https://untrusted.test" }, data: { requestId: record } })).status()).toBe(403);
  }
});
test("pilot evidence routes deny anonymous callers and cross-origin writes (P09-T006)", async ({ page, request }) => {
  const base = `/api/v1/scopes/${scope}/pilot/cohorts/${cohort}`;
  expect((await request.get(base + "/evidence")).status()).toBe(401);
  for (const path of ["/observations", "/findings", "/findings/" + record + "/close", "/reviews"]) {
    expect((await request.post(base + path, { headers: origin, data: { requestId: record } })).status()).toBe(401);
    expect((await request.post(base + path, { headers: { origin: "https://untrusted.test" }, data: { requestId: record } })).status()).toBe(403);
  }
  await page.goto(`/admin/pilot/${cohort}/evidence?scope=${scope}`);
  await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
});
