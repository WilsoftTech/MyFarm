import { test, expect } from "@playwright/test";
const farm = "11111111-1111-4111-8111-111111111111";
test("anonymous users cannot open registry pages", async ({ page }) => {
for (const path of ["/farmer", "/farmer/edit", "/farms", "/farms/new", "/farms/" + farm]) {
await page.goto(path); await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
}
});
test("anonymous protected pages get a real redirect, not a streamed page", async ({ request }) => {
for (const path of ["/workspace", "/admin", "/agent", "/farmer", "/farmer/edit", "/farms", "/farms/new", "/farms/" + farm]) {
const response = await request.get(path, { maxRedirects: 0 });
expect(response.status(), path).toBe(307);
expect(response.headers()["location"]).toBe("/sign-in?reason=session-required");
expect(response.headers()["cache-control"]).toContain("no-store");
expect(["", "/sign-in?reason=session-required"]).toContain(await response.text()); // redirect target only, never page content
}
});
test("anonymous registry APIs fail closed with no caching or detail", async ({ request }) => {
for (const path of ["/api/v1/farmer", "/api/v1/farms", "/api/v1/farms/" + farm, "/api/v1/farms/not-a-uuid"]) {
const response = await request.get(path); expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
const body = await response.json(); expect(body.error).toBe("UNAUTHENTICATED"); expect(body).not.toHaveProperty("stack");
}
const origin = "http://127.0.0.1:3101";
for (const [method, path] of [["post", "/api/v1/farmer"], ["patch", "/api/v1/farmer"], ["post", "/api/v1/farms"], ["post", "/api/v1/farms/" + farm + "/plots"]] as const) {
const response = await request[method](path, { headers: { origin }, data: { requestId: "33333333-3333-4333-8333-333333333333", name: "Probe" } });
expect(response.status()).toBe(401); expect((await response.json()).error).toBe("UNAUTHENTICATED");
}
});
test("registry commands reject cross-origin requests", async ({ request }) => {
for (const path of ["/api/v1/farmer", "/api/v1/farms", "/api/v1/farms/" + farm + "/plots"]) {
const response = await request.post(path, { headers: { origin: "https://untrusted.test" }, data: { requestId: "33333333-3333-4333-8333-333333333333" } });
expect(response.status()).toBe(403); expect((await response.json()).error).toBe("FORBIDDEN");
}
});
