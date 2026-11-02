import { expect, type BrowserContext, type Page } from "@playwright/test";
import type { prepareInventoryBrowser } from "./inventory-browser";

export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
export type OutboxRow = { clientMutationId: string; operation: string; syncStatus: string; attemptCount: number; lastError: string | null; farmId: string; createdAt: string; result: Record<string, unknown> | null; leaseUntil: string | null; payload: Record<string, unknown> };
type Fixtures = Awaited<ReturnType<typeof prepareInventoryBrowser>>;

/** Reads a store, or writes one row, in an account's database, which must already exist. */
export const inDatabase = <T,>(page: Page, accountId: string, store: string, write?: object) => page.evaluate(([name, table, value]) => new Promise<T>((resolve, reject) => {
  const open = indexedDB.open(name as string);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction(table as string, value ? "readwrite" : "readonly");
    const request = value ? tx.objectStore(table as string).put(value) : tx.objectStore(table as string).getAll();
    tx.oncomplete = () => { open.result.close(); resolve(request.result as T); };
    tx.onerror = () => reject(tx.error);
  };
}), ["myfarm-offline-" + accountId, store, write ?? null] as const);
export const outbox = (page: Page, accountId: string) => inDatabase<OutboxRow[]>(page, accountId, "outbox");

/** Opens a signed-in page and waits for the phone to finish its first save of farm data and shell. */
export async function prepared(context: BrowserContext, page: Page, base: string, f: Fixtures, cookie = f.accounts.a.cookie, account = f.users.a) {
  await context.addCookies([{ name: "sb-127-auth-token", value: cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(base + "/farms");
  await expect.poll(() => page.evaluate(async id => {
    const name = "myfarm-offline-" + id;
    if (!(await indexedDB.databases()).some(row => row.name === name)) return false;
    return new Promise<boolean>(resolve => {
      const open = indexedDB.open(name);
      open.onerror = () => resolve(false);
      open.onsuccess = () => {
        if (!open.result.objectStoreNames.contains("meta")) { open.result.close(); resolve(false); return; }
        const request = open.result.transaction("meta").objectStore("meta").get("lastSyncAt");
        request.onsuccess = () => { open.result.close(); resolve(Boolean(request.result)); };
      };
    });
  }, account), { timeout: 30_000 }).toBe(true);
  await page.waitForFunction(async () => !!(await caches.match("/offline")), undefined, { timeout: 20_000 });
}
export async function openOffline(page: Page, base: string, farm: string) {
  await page.goto(base + "/offline");
  await page.getByLabel("Choose a farm", { exact: true }).selectOption(farm);
}
export async function recordExpense(page: Page, amount: string) {
  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("What was it for?", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Amount", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();
}
export async function expenseCount(context: BrowserContext, base: string, farm: string, amount: string) {
  const response = await context.request.get(`${base}/api/v1/farms/${farm}/accounting/records?limit=50`);
  const body = await response.json() as { items: { amount: string }[] };
  return body.items.filter(row => row.amount === amount).length;
}
