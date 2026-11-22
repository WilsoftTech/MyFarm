import { test, expect } from "@playwright/test";
const farm = "11111111-1111-4111-8111-111111111111";
test("officer dashboard and consent reads authenticate before scope validation", async ({ request }) => {
  for (const path of ["/api/v1/agent/dashboard?scope=guessed", `/api/v1/farms/${farm}/officers`, `/api/v1/agent/registrations/${farm}`, `/api/v1/farms/${farm}/officer-work?scope=guessed`]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).error).toBe("UNAUTHENTICATED");
  }
});

test("registration and visit writes authenticate and reject cross-origin requests", async ({ request }) => {
  for (const path of ["/api/v1/agent/registrations?scope=guessed", `/api/v1/agent/registrations/${farm}/accept`, `/api/v1/farms/${farm}/officer-work?scope=guessed`, "/api/v1/agent/sync"]) {
    const anonymous = await request.post(path, { headers: { origin: "http://127.0.0.1:3101" }, data: {} }); expect(anonymous.status()).toBe(401);
    const foreign = await request.post(path, { headers: { origin: "https://untrusted.test" }, data: {} }); expect(foreign.status()).toBe(403);
  }
});
test("officer consent writes require a current session and same origin", async ({ request }) => {
  for (const suffix of ["", "/revoke"]) {
    const path = `/api/v1/farms/${farm}/officers${suffix}`;
    const anonymous = await request.post(path, { headers: { origin: "http://127.0.0.1:3101" }, data: {} });
    expect(anonymous.status()).toBe(401);
    const crossOrigin = await request.post(path, { headers: { origin: "https://untrusted.test" }, data: {} });
    expect(crossOrigin.status()).toBe(403);
  }
});
