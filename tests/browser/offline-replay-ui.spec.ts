import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";
import { offlineServer } from "../support/offline-server";
import { expenseCount, inDatabase, openOffline, outbox, prepared, recordExpense } from "../support/offline-browser";

test.setTimeout(120_000);
const allSent = "All your entries have been sent.";
async function membership(userId: string, status: "ACTIVE" | "REVOKED") {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { await db.query('UPDATE "FarmMember" SET status=$1 WHERE "userId"=$2', [status, userId]); } finally { await db.end(); }
}

test("MYF-P07-AC004 the source's critical test: offline expense, lost acknowledgement, reconnect, one transaction", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "808080");
    await expect(page.getByText("Waiting to send", { exact: true })).toHaveCount(1);
    await server.start();

    // The server commits, then the answer is lost on the way back.
    let lost = 0;
    await page.route("**/api/v1/sync/push", async route => { await route.fetch(); lost += 1; await route.abort("connectionreset"); });
    await page.getByRole("button", { name: "Send now" }).click();
    await expect.poll(() => lost).toBe(1);
    await expect(page.getByText("Could not reach MyFarm. Your entries are safe on this phone")).toBeVisible();
    expect((await outbox(page, account))[0].syncStatus).toBe("PENDING");
    expect(await expenseCount(context, base, farm, "808080")).toBe(1);
    await page.unroute("**/api/v1/sync/push");

    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText(allSent)).toBeVisible({ timeout: 20_000 });
    expect((await outbox(page, account))[0].syncStatus).toBe("SYNCED");
    expect(await expenseCount(context, base, farm, "808080")).toBe(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC004 two tabs sending at once create one transaction", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "818181");
    const second = await context.newPage();
    await openOffline(second, base, farm);
    await server.start();
    await Promise.all([page.getByRole("button", { name: "Send now" }).click(), second.getByRole("button", { name: "Send now" }).click()]);
    await expect.poll(async () => (await outbox(page, account))[0].syncStatus, { timeout: 20_000 }).toBe("SYNCED");
    expect(await expenseCount(context, base, farm, "818181")).toBe(1);
    await second.close();
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC004 two phones finishing one task: one is accepted and the other asks for review", async ({ page, context, browser }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  const otherContext = await browser.newContext(), other = await otherContext.newPage();
  try {
    await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
    const made = await context.request.post(`${base}/api/v1/farms/${farm}/activities`, { headers: { origin: base }, data: { requestId: crypto.randomUUID(), type: "CLEANING", dueOn: "2030-02-02" } });
    const { activity } = await made.json() as { activity: { activityId: string } };
    for (const [ctx, tab] of [[context, page], [otherContext, other]] as const) {
      await prepared(ctx, tab, base, f);
      await openOffline(tab, base, farm);
      await tab.getByRole("button", { name: "View records" }).click();
    }
    await server.stop();
    for (const tab of [page, other]) await tab.getByRole("button", { name: "Mark done" }).first().click();
    await server.start();
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText(allSent)).toBeVisible({ timeout: 20_000 });
    await other.getByRole("button", { name: "Send now" }).click();
    await expect(other.getByRole("paragraph").filter({ hasText: "Needs your review" })).toBeVisible({ timeout: 20_000 });
    const detail = await (await context.request.get(`${base}/api/v1/farms/${farm}/activities/${activity.activityId}`)).json() as { activity: { version: number; status: string } };
    expect(detail.activity).toMatchObject({ version: 2, status: "COMPLETED" });
    expect((await outbox(other, account))[0].syncStatus).toBe("CONFLICT");
  } finally { await otherContext.close(); await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC004 a revoked member keeps their entry but cannot commit it, and an ended session asks to sign in", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "828282");
    await recordExpense(page, "838383");
    await server.start();

    const cookies = await context.cookies();
    await context.clearCookies();
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("Sign in again to send your entries.")).toBeVisible();
    expect((await outbox(page, account)).map(row => row.syncStatus)).toEqual(["PENDING", "PENDING"]);
    await context.addCookies(cookies);

    await membership(account, "REVOKED");
    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("You no longer have access to this farm.").first()).toBeVisible({ timeout: 20_000 });
    expect((await outbox(page, account)).map(row => row.syncStatus)).toEqual(["FAILED", "FAILED"]);
    await expect(page.getByRole("button", { name: "Download a copy" })).toBeVisible();
    await membership(account, "ACTIVE");
    expect(await expenseCount(context, base, farm, "828282")).toBe(0);
  } finally { await membership(account, "ACTIVE"); await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC004 an interrupted or expired pull keeps saved copies and unsent entries", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    const saved = (await inDatabase<unknown[]>(page, account, "records")).length;
    expect(saved).toBeGreaterThan(0);

    let calls = 0;
    await page.route("**/api/v1/sync/pull*", async route => {
      calls += 1;
      if (calls === 1) await route.fulfill({ status: 200, contentType: "application/json", body: '{"status":"EXPIRED"}' });
      else await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"UNAVAILABLE"}' });
    });
    await page.getByRole("button", { name: "Send now" }).click();
    await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("Could not reach MyFarm. Your entries are safe on this phone")).toBeVisible();
    expect((await inDatabase<unknown[]>(page, account, "records")).length).toBe(saved);
    await page.unroute("**/api/v1/sync/pull*");

    await page.getByRole("button", { name: "Send now" }).click();
    await expect(page.getByText("Everything that could be sent has been sent.")).toBeVisible({ timeout: 20_000 });
    expect((await inDatabase<unknown[]>(page, account, "records")).length).toBeGreaterThan(0);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("D-P07-002 entries older than the support window warn clearly and still send once, and a full queue refuses new ones", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "848484");
    const [row] = await outbox(page, account);
    // Simulated age: the entry's stored date is moved back, not 15 real days waited.
    await inDatabase(page, account, "outbox", { ...row, createdAt: new Date(Date.now() - 15 * 86_400_000).toISOString() });
    await page.reload();
    await expect(page.getByText("Some entries have waited 14 days or more.")).toBeVisible();

    const filler = { ...row, syncStatus: "FAILED", lastError: "Filler" };
    await page.evaluate(([id, base]) => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("myfarm-offline-" + id);
      open.onsuccess = () => {
        const tx = open.result.transaction("outbox", "readwrite");
        for (let index = 0; index < 500; index++) tx.objectStore("outbox").put({ ...(base as object), clientMutationId: crypto.randomUUID() });
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), [account, filler] as const);
    await page.reload();
    await page.getByLabel("Choose a farm", { exact: true }).selectOption(farm);
    await expect(page.getByText("You have reached the limit of unsent entries.")).toBeVisible();
    await page.getByRole("button", { name: "Record expense" }).click();
    await page.getByLabel("What was it for?", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Amount", { exact: true }).fill("858585");
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Not saved: you have reached the limit of unsent entries.")).toBeVisible();
    await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("858585");

    await page.evaluate(id => new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("myfarm-offline-" + id);
      open.onsuccess = () => {
        const tx = open.result.transaction("outbox", "readwrite"), store = tx.objectStore("outbox"), cursor = store.openCursor();
        cursor.onsuccess = () => { if (cursor.result) { if (cursor.result.value.lastError === "Filler") cursor.result.delete(); cursor.result.continue(); } };
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }), account);
    await server.start();
    await page.reload();
    await expect(page.getByText(allSent)).toBeVisible({ timeout: 20_000 });
    expect(await expenseCount(context, base, farm, "848484")).toBe(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("D-P07-003 a shared phone keeps accounts apart, and unsent entries wait for their own account", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "868686");
    await server.start();

    await page.route("**/api/v1/sync/push", route => route.abort());
    await page.goto(base + "/farms");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await context.clearCookies();

    await prepared(context, page, base, f, f.accounts.b.cookie, f.users.b);
    await page.goto(base + "/offline");
    await expect(page.getByText("Entries waiting to send").locator("..").getByText("0", { exact: true })).toBeVisible();
    await expect(page.getByText("Nothing is waiting to send.")).toBeVisible();
    expect(await outbox(page, f.users.b)).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem("myfarm.offline.account"))).toBe(f.users.b);
    expect((await outbox(page, account)).map(row => row.syncStatus)).toEqual(["PENDING"]);
    expect(await inDatabase<unknown[]>(page, account, "farms")).toHaveLength(0);
    const cachedForB = await inDatabase<{ farmId: string }[]>(page, f.users.b, "farms");
    expect(cachedForB.map(row => row.farmId)).not.toContain(farm);

    await page.unroute("**/api/v1/sync/push");
    await page.goto(base + "/farms");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await context.clearCookies();
    await prepared(context, page, base, f);
    await expect.poll(async () => (await outbox(page, account))[0].syncStatus, { timeout: 20_000 }).toBe("SYNCED");
    expect(await expenseCount(context, base, farm, "868686")).toBe(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("a service worker replaced while entries wait leaves them intact and they still send", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await server.start();
  try {
    await prepared(context, page, base, f);
    await openOffline(page, base, farm);
    await server.stop();
    await recordExpense(page, "878787");
    await server.start();
    await page.route("**/api/v1/sync/push", route => route.abort());
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.unregister();
      for (const name of await caches.keys()) await caches.delete(name);
      await navigator.serviceWorker.register("/sw.js");
    });
    await page.waitForFunction(async () => !!(await caches.match("/offline")), undefined, { timeout: 20_000 });
    expect((await outbox(page, account)).map(row => row.operation)).toEqual(["RECORD_EXPENSE"]);
    await page.unroute("**/api/v1/sync/push");
    await page.reload();
    await expect(page.getByText(allSent)).toBeVisible({ timeout: 20_000 });
    expect(await expenseCount(context, base, farm, "878787")).toBe(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});
