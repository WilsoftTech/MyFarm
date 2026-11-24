import { test, expect } from "@playwright/test";
const organizationId = "11111111-1111-4111-8111-111111111111";
test("organization reads authenticate before validating guessed scopes and never cache private data", async ({ request }) => {
  for (const path of ["/api/v1/cooperatives", "/api/v1/cooperatives/guessed?section=members", `/api/v1/cooperatives/${organizationId}?section=lots`]) {
    const response = await request.get(path); expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store"); expect((await response.json()).error).toBe("UNAUTHENTICATED");
  }
});
test("organization creation, consent and ledger writes enforce session and same origin", async ({ request }) => {
  for (const path of ["/api/v1/cooperatives", `/api/v1/cooperatives/${organizationId}/relationships`, `/api/v1/cooperatives/${organizationId}/operations`]) {
    const anonymous = await request.post(path, { headers: { origin: "http://127.0.0.1:3101" }, data: {} }); expect(anonymous.status()).toBe(401);
    const foreign = await request.post(path, { headers: { origin: "https://untrusted.test" }, data: {} }); expect(foreign.status()).toBe(403);
  }
});
