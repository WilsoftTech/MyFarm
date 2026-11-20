import { expect, test } from "@playwright/test";
const farm = "11111111-1111-4111-8111-111111111111", draft = "22222222-2222-4222-8222-222222222222";
test("voice draft reads authenticate before validation and remain private", async ({ request }) => {
  for (const id of [draft, "invalid"]) {
    const response = await request.get(`/api/v1/farms/${farm}/voice/drafts/${id}`);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).error).toBe("UNAUTHENTICATED");
  }
});
test("the expense review page requires sign-in and keeps microphone access disabled", async ({ page, request }) => {
  const response = await request.get(`/farms/${farm}/voice`, { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toContain("/sign-in");
  expect(response.headers()["permissions-policy"]).toContain("microphone=()");
  await page.goto(`/farms/${farm}/voice`); await expect(page).toHaveURL(/\/sign-in/);
});
test("voice draft writes and confirmation enforce origin, JSON and authentication", async ({ request }) => {
  for (const [method, suffix] of [["POST", ""], ["PATCH", "/" + draft], ["POST", "/" + draft + "/confirm"]]) {
    const url = `/api/v1/farms/${farm}/voice/drafts${suffix}`;
    const origins: Record<string, string>[] = [{}, { origin: "https://attacker.example" }];
    for (const headers of origins) {
      const response = await request.fetch(url, { method, headers, data: {} });
      expect(response.status()).toBe(403);
      expect(response.headers()["cache-control"]).toContain("no-store");
    }
    const response = await request.fetch(url, { method, headers: { origin: "http://127.0.0.1:3101" }, data: {} });
    expect(response.status()).toBe(401); expect((await response.json()).error).toBe("UNAUTHENTICATED");
    const malformed = await request.fetch(url, { method, headers: { origin: "http://127.0.0.1:3101", "content-type": "application/json" }, data: Buffer.from("{") });
    expect(malformed.status()).toBe(400);
  }
});
test("voice input capabilities and suggestions are authenticated and cannot take scope from a body", async ({ request }) => {
  const base = `/api/v1/farms/${farm}/voice`;
  expect((await request.get(base + "/capabilities")).status()).toBe(401);
  expect((await request.get(base + "/drafts/" + draft + "/status")).status()).toBe(401);
  expect((await request.post(base + "/intent", { headers: { origin: "http://127.0.0.1:3101" }, data: { language: "en", text: "yes" } })).status()).toBe(401);
  expect((await request.post(base + "/intent", { headers: { origin: "https://attacker.example" }, data: {} })).status()).toBe(403);
});
