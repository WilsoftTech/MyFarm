import { expect, test } from "@playwright/test";
const farm = "11111111-1111-4111-8111-111111111111", record = "22222222-2222-4222-8222-222222222222";
test("production pages send anonymous users to sign-in before rendering farm records", async ({ page }) => {
  for (const resource of ["enterprises", "seasons", "crop-cycles", "poultry-batches"]) {
    for (const suffix of ["", "/new", "/" + record]) {
      await page.goto(`/farms/${farm}/${resource}${suffix}`);
      await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
      await expect(page.getByRole("heading", { name: "Sign in to MyFarm" })).toBeVisible();
    }
  }
});
test("production pages return a private, real redirect for anonymous requests", async ({ request }) => {
  for (const resource of ["enterprises", "seasons", "crop-cycles", "poultry-batches"]) {
    const response = await request.get(`/farms/${farm}/${resource}/new`, { maxRedirects: 0 });
    expect(response.status()).toBe(307); expect(response.headers()["location"]).toBe("/sign-in?reason=session-required");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("accounting pages send anonymous users to sign-in before rendering farm money records (P04-T003)", async ({ page, request }) => {
  for (const path of ["accounting", "accounting/new/sale", "accounting/new/expense", "accounting/records/" + record, "accounting/records/" + record + "/payments/new", "accounting/payments/" + record, "accounting/summary", "accounting/gross-margin"]) {
    await page.goto(`/farms/${farm}/${path}`);
    await expect(page).toHaveURL(/\/sign-in\?reason=session-required/);
    const response = await request.get(`/farms/${farm}/${path}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307); expect(response.headers()["location"]).toBe("/sign-in?reason=session-required");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
