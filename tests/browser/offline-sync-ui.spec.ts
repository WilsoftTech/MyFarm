import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";
import { offlineServer } from "../support/offline-server";

test.setTimeout(120_000);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
type Row = { clientMutationId: string; operation: string; syncStatus: string; attemptCount: number; lastError: string | null; farmId: string; result: Record<string, unknown> | null; leaseUntil: string | null };
const inDatabase = <T,>(page: Page, accountId: string, store: string, write?: object) => page.evaluate(([name, table, value]) => new Promise<T>((resolve, reject) => {
  const open = indexedDB.open(name as string);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const tx = open.result.transaction(table as string, value ? "readwrite" : "readonly");
    const request = value ? tx.objectStore(table as string).put(value) : tx.objectStore(table as string).getAll();
    tx.oncomplete = () => { open.result.close(); resolve(request.result as T); };
    tx.onerror = () => reject(tx.error);
  };
}), ["myfarm-offline-" + accountId, store, write ?? null] as const);
const outbox = (page: Page, accountId: string) => inDatabase<Row[]>(page, accountId, "outbox");

async function prepared(context: BrowserContext, page: Page, base: string, f: Awaited<ReturnType<typeof prepareInventoryBrowser>>, cookie = f.accounts.a.cookie, account = f.users.a) {
  await context.addCookies([{ name: "sb-127-auth-token", value: cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(base + "/farms");
  await expect.poll(() => page.evaluate(async id => {
    const name = "myfarm-offline-" + id;
    if (!(await indexedDB.databases()).some(row => row.name === name)) return false;
    return new Promise<boolean>(resolve => { const open = indexedDB.open(name); open.onerror = () => resolve(false); open.onsuccess = () => {
      if (!open.result.objectStoreNames.contains("meta")) { open.result.close(); resolve(false); return; }
      const request = open.result.transaction("meta").objectStore("meta").get("lastSyncAt"); request.onsuccess = () => { open.result.close(); resolve(Boolean(request.result)); }; }; });
  }, account), { timeout: 30_000 }).toBe(true);
  await page.waitForFunction(async () => !!(await caches.match("/offline")), undefined, { timeout: 20_000 });
}
const openOffline = async (page: Page, base: string, farm: string) => {
  await page.goto(base + "/offline");
  await page.getByLabel("Choose a farm", { exact: true }).selectOption(farm);
};
const recordExpense = async (page: Page, amount: string) => {
  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("What was it for?", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Amount", { exact: true }).fill(amount);
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();
};
const expenses = async (context: BrowserContext, base: string, farm: string, amount: string) => {
  const response = await context.request.get(`${base}/api/v1/farms/${farm}/accounting/records?limit=50`);
  const body = await response.json() as { items: { amount: string }[] };
  return body.items.filter(row => row.amount === amount).length;
};

test("MYF-P07-AC003 entries saved offline send on reconnecting, with a photo after its parent", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await page.getByRole("button", { name: "Record activity" }).click();
    await page.getByLabel("Activity", { exact: true }).selectOption("INSPECTION");
    await page.getByRole("button", { name: "Save activity" }).click();
    await expect(page.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();
    await page.getByRole("button", { name: "Take photo" }).click();
    const target = page.getByLabel("Attach to", { exact: true });
    await target.selectOption({ label: await target.locator("option").filter({ hasText: "Activity done" }).first().innerText() });
    await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "inspection.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Save photo" }).click();
    await expect(page.getByText("Photo saved on this phone.")).toBeVisible();
    await recordExpense(page, "151515");
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("Could not reach MyFarm. Your entries are safe on this phone")).toBeVisible();
    await expect(page.getByText("Waiting to send", { exact: true })).toHaveCount(3);
    expect((await outbox(page, account)).every(row => row.syncStatus === "PENDING" && row.leaseUntil === null)).toBe(true);

    await server.start();
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("All your entries have been sent.")).toBeVisible({ timeout: 20_000 });
    const rows = await outbox(page, account);
    expect(rows.map(row => row.syncStatus)).toEqual(["SYNCED", "SYNCED", "SYNCED"]);
    expect(await expenses(context, base, farm, "151515")).toBe(1);
    const activityId = String(rows.find(row => row.operation === "RECORD_ACTIVITY")?.result?.activityId);
    const list = await context.request.get(`${base}/api/v1/farms/${farm}/photos?target=ACTIVITY&recordId=${activityId}`);
    expect((await list.json() as { items: unknown[] }).items).toHaveLength(1);
    expect(await inDatabase<unknown[]>(page, account, "photos")).toHaveLength(0);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC003 a send abandoned by a crash goes again, once", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "161616");
    const [row] = await outbox(page, account);
    await inDatabase(page, account, "outbox", { ...row, syncStatus: "SYNCING", leaseUntil: new Date(Date.now() - 1000).toISOString() });
    await server.start();
    await page.reload();
    await expect(page.getByText("All your entries have been sent.")).toBeVisible({ timeout: 20_000 });
    expect((await outbox(page, account))[0].syncStatus).toBe("SYNCED");
    expect(await expenses(context, base, farm, "161616")).toBe(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC003 a refused entry stays for repair, holds its child, and sends after fixing", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "171717");
    const [row] = await outbox(page, account);
    await inDatabase(page, account, "outbox", { ...row, payload: { ...(row as unknown as { payload: object }).payload, amount: "-5" } });
    await page.reload();
    await page.getByLabel("Choose a farm", { exact: true }).selectOption(farm);
    await page.getByRole("button", { name: "Take photo" }).click();
    const target = page.getByLabel("Attach to", { exact: true });
    await target.selectOption({ label: await target.locator("option").filter({ hasText: "Expense" }).first().innerText() });
    await page.getByLabel("Photo", { exact: true }).setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Save photo" }).click();
    await expect(page.getByText("Photo saved on this phone.")).toBeVisible();

    await server.start();
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("MyFarm could not accept these details.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("paragraph").filter({ hasText: /^Could not send$/ })).toBeVisible();
    await expect(page.getByText("waiting for another entry to be sorted out")).toBeVisible();
    expect(await expenses(context, base, farm, "171717")).toBe(0);

    await page.getByRole("button", { name: "Fix details" }).click();
    await page.getByLabel("Amount (optional)", { exact: true }).fill("171717");
    await page.getByRole("button", { name: "Save and send" }).click();
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("All your entries have been sent.")).toBeVisible({ timeout: 20_000 });
    expect(await expenses(context, base, farm, "171717")).toBe(1);
    const rows = await outbox(page, account);
    expect(rows.filter(entry => entry.syncStatus !== "SYNCED")).toEqual([]);
    expect(new Set(rows.map(entry => entry.clientMutationId)).has(row.clientMutationId)).toBe(false);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC003 a stale edit asks for review and never overwrites the newer change", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a, headers = { origin: base };
  await server.start();
  try {
    await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
    const made = await context.request.post(`${base}/api/v1/farms/${farm}/activities`, { headers, data: { requestId: crypto.randomUUID(), type: "CLEANING", dueOn: "2030-01-01" } });
    const { activity } = await made.json() as { activity: { activityId: string } };
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await page.getByRole("button", { name: "View records" }).click();
    await page.getByRole("button", { name: "Mark done" }).first().click();
    await expect(page.getByText("Waiting to send", { exact: true }).first()).toBeVisible();

    await server.start();
    const other = await context.request.post(`${base}/api/v1/farms/${farm}/activities/${activity.activityId}/complete`, { headers, data: { requestId: crypto.randomUUID(), expectedVersion: 1, workerName: "Other device" } });
    expect(other.status()).toBe(200);
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByRole("paragraph").filter({ hasText: "Needs your review" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("It was already finished elsewhere")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again on the latest version" })).toHaveCount(0);
    const detail = await (await context.request.get(`${base}/api/v1/farms/${farm}/activities/${activity.activityId}`)).json() as { activity: { workerName: string; version: number } };
    expect(detail.activity).toMatchObject({ workerName: "Other device", version: 2 });

    await page.getByRole("button", { name: "Discard" }).click();
    await page.getByRole("button", { name: "Yes, discard it" }).click();
    await expect(page.getByText("Needs your review", { exact: true })).toHaveCount(0);
    expect(await outbox(page, account)).toHaveLength(0);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC003 a passing server failure retries, and a copy of unsent entries can be downloaded", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await page.route("**/api/v1/sync/push", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"UNAVAILABLE"}' }));
    await recordExpense(page, "181818");
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("Could not reach MyFarm. Your entries are safe on this phone")).toBeVisible();
    await expect.poll(async () => (await outbox(page, account))[0].attemptCount).toBeGreaterThan(0);
    expect((await outbox(page, account))[0].syncStatus).toBe("PENDING");
    expect(await expenses(context, base, farm, "181818")).toBe(0);

    await expect(page.getByText("The download is not encrypted")).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download a copy" }).click()]);
    expect(download.suggestedFilename()).toBe("myfarm-unsent-entries.json");
    const text = await (await import("node:fs/promises")).readFile(await download.path(), "utf8");
    expect(JSON.parse(text)).toMatchObject({ note: expect.stringContaining("not encrypted"), entries: [{ what: "RECORD_EXPENSE", status: "PENDING", details: { amount: "181818" } }] });

    await page.unroute("**/api/v1/sync/push");
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("All your entries have been sent.")).toBeVisible({ timeout: 20_000 });
    expect(await expenses(context, base, farm, "181818")).toBe(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});
