import { test, expect } from "@playwright/test";
test("public shell works on desktop and mobile", async ({ page }) => {
await page.goto("/");
await expect(page.getByRole("heading", { name: "A clearer picture of your farm." })).toBeVisible();
await expect(page.getByText("MyFarm · Built around the farm.")).toBeVisible();
expect(await page.evaluate(() => /\u00C2|\u00E2\u20AC|\u00E2\u2020/.test(document.body.innerText + document.title))).toBe(false);
await page.getByRole("link", { name: "Sign in to MyFarm" }).click();
await expect(page.getByRole("heading", { name: "Sign in to MyFarm" })).toBeVisible();
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test("anonymous users cannot open protected workspace", async ({ page }) => {
await page.goto("/workspace"); await expect(page).toHaveURL(/\/sign-in/);
await page.goto("/admin?scope=11111111-1111-4111-8111-111111111111");
await expect(page).toHaveURL(/\/sign-in/);
});
test("anonymous APIs fail closed with no caching", async ({ request }) => {
for (const path of ["/api/v1/session", "/api/v1/health", "/api/v1/scopes/11111111-1111-4111-8111-111111111111"]) {
const response = await request.get(path); expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toContain("no-store");
const body = await response.json(); expect(body.error).toBe("UNAUTHENTICATED"); expect(body).not.toHaveProperty("stack");
}
});
test("health and manifest expose no secrets", async ({ request }) => {
expect(await (await request.get("/api/health")).json()).toEqual({ status: "ok", service: "myfarm" });
expect((await (await request.get("/manifest.webmanifest")).json()).name).toBe("MyFarm");
const response = await request.get("/"); expect(response.headers()["x-content-type-options"]).toBe("nosniff"); expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});
test("keyboard skip link targets content", async ({ page }) => {
await page.goto("/"); await page.keyboard.press("Tab"); await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
await page.keyboard.press("Enter"); await expect(page).toHaveURL(/#main$/);
});

test("invalid sign-in is rejected without auth request", async ({ page }) => {
await page.goto("/sign-in"); await page.getByRole("button", { name: "Sign in", exact: true }).click();
await expect(page.getByText("Enter a valid email address.")).toBeVisible();
await expect(page.getByLabel("Email address")).toBeFocused();
});
test("private-file grants reject cross-origin requests", async ({ request }) => {
const response = await request.post("/api/v1/scopes/11111111-1111-4111-8111-111111111111/files/22222222-2222-4222-8222-222222222222", { headers: { origin: "https://untrusted.test" }, data: { requestId: "33333333-3333-4333-8333-333333333333" } });
expect(response.status()).toBe(403); expect((await response.json()).error).toBe("FORBIDDEN");
});
