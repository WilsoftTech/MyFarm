import { expect, test, type Page } from "@playwright/test";
import { prepareInventoryBrowser } from "../support/inventory-browser";
import { offlineServer } from "../support/offline-server";

const ready = (page: Page) => page.waitForFunction(async () => {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration?.active?.state === "activated" && !!(await caches.match("/offline"));
}, undefined, { timeout: 20_000 });
const account = (page: Page) => page.evaluate(() => localStorage.getItem("myfarm.offline.account"));
const raw = (page: Page, accountId: string, store: string, mode: "count" | "seed", row?: object) => page.evaluate(([name, table, kind, value]) => new Promise<number>((resolve, reject) => {
  const open = indexedDB.open(name as string);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction(table as string, kind === "seed" ? "readwrite" : "readonly");
    const request = kind === "seed" ? tx.objectStore(table as string).put(value) : tx.objectStore(table as string).count();
    tx.oncomplete = () => { open.result.close(); resolve(kind === "seed" ? 1 : (request.result as number)); };
    tx.onerror = () => reject(tx.error);
  };
}), ["myfarm-offline-" + accountId, store, mode, row ?? null] as const);

test("MYF-P07-AC001 the shell reopens with no network and signed-in pages are never stored", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
  await server.start();
  try {
  await page.goto(base + "/farms");
  await ready(page);
  await expect.poll(() => account(page)).toBe(f.users.a);
  await page.goto(base + "/offline");
  await page.getByText("Entries waiting to send").waitFor();

  await server.stop();
  const cold = await context.newPage();
  await page.close();
  await cold.goto(base + "/offline");
  await expect(cold.getByRole("heading", { name: "Offline work" })).toBeVisible();
  await expect(cold.getByText("Entries waiting to send")).toBeVisible();
  await context.setOffline(true);
  await expect(cold.getByText("You are offline. Entries are saved on this phone until you reconnect.")).toBeVisible();
  await context.setOffline(false);

  await cold.goto(base + `/farms/${f.farms.a}/accounting`);
  await expect(cold).toHaveURL(/\/offline$/);
  await expect(cold.getByRole("heading", { name: "Offline work" })).toBeVisible();

  const stored = await cold.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname)))).flat());
  expect(stored).toContain("/offline");
  for (const path of stored) expect(path === "/offline" || path === "/manifest.webmanifest" || path === "/icon.svg" || path.startsWith("/_next/static/")).toBe(true);

  await server.start();
  await cold.goto(base + `/farms/${f.farms.a}/accounting`);
  await expect(cold.getByRole("heading", { name: "Money records", exact: true })).toBeVisible();
  await cold.close();
  } finally { await server.stop(); }
});

test("MYF-P07-AC001 storage warnings are visible and a phone with no prepared account says so", async ({ page, context }) => {
  const f = await prepareInventoryBrowser();
  await page.goto("/offline");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, "persisted", { value: async () => false });
    Object.defineProperty(navigator.storage, "estimate", { value: async () => ({ usage: 99_000_000, quota: 100_000_000 }) });
  });
  await page.goto("/farms");
  await expect.poll(() => account(page)).toBe(f.users.a);
  await page.goto("/offline");
  await expect(page.getByText("This browser may clear saved entries")).toBeVisible();
  await expect(page.getByText("This phone is low on space.")).toBeVisible();
  await expect(page.getByText("MyFarm cannot recover them if the browser data is cleared")).toBeVisible();
});

test("MYF-P07-AC001 eviction leaves a working empty shell, and sign-out clears cached data but keeps unsent entries", async ({ page, context }) => {
  const f = await prepareInventoryBrowser();
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/farms");
  await expect.poll(() => account(page)).toBe(f.users.a);
  await page.goto("/offline");
  await expect(page.getByText("Entries waiting to send")).toBeVisible();

  await page.evaluate(id => new Promise<void>(resolve => { const request = indexedDB.deleteDatabase("myfarm-offline-" + id); request.onsuccess = request.onerror = request.onblocked = () => resolve(); }), f.users.a);
  await page.reload();
  await expect(page.getByText("Entries waiting to send")).toBeVisible();
  await expect(page.getByText("Not yet", { exact: true })).toBeVisible();

  await raw(page, f.users.a, "farms", "seed", { farmId: f.farms.a, name: "Cached farm", cachedAt: new Date().toISOString() });
  await raw(page, f.users.a, "outbox", "seed", { clientMutationId: crypto.randomUUID(), syncStatus: "PENDING", createdAt: new Date().toISOString(), farmId: f.farms.a, dependsOn: null });
  // The account answer is held back so it arrives after sign-out, which must not restore the account.
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/sync/account", async route => { await held; await route.continue().catch(() => undefined); });
  await page.goto("/farms");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  release();
  await expect.poll(() => raw(page, f.users.a, "farms", "count")).toBe(0);
  expect(await raw(page, f.users.a, "outbox", "count")).toBe(1);
  await page.waitForTimeout(500);
  expect(await account(page)).toBeNull();
});
