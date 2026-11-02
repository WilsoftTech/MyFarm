import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { z } from "zod";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";
import { offlineServer } from "../support/offline-server";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const outbox = (page: Page, accountId: string) => page.evaluate(id => new Promise<{ clientMutationId: string; operation: string; syncStatus: string; deviceId: string; version: number; createdAt: string; dependsOn: string | null }[]>((resolve, reject) => {
  const open = indexedDB.open("myfarm-offline-" + id);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => { const request = open.result.transaction("outbox").objectStore("outbox").getAll(); request.onsuccess = () => { open.result.close(); resolve(request.result); }; };
}), accountId);
const photos = (page: Page, accountId: string) => page.evaluate(id => new Promise<{ sha256: string; byteSize: number; contentType: string; size: number }[]>((resolve, reject) => {
  const open = indexedDB.open("myfarm-offline-" + id);
  open.onerror = () => reject(open.error);
  open.onsuccess = () => { const request = open.result.transaction("photos").objectStore("photos").getAll(); request.onsuccess = () => { open.result.close(); resolve(request.result.map(row => ({ sha256: row.sha256, byteSize: row.byteSize, contentType: row.contentType, size: row.blob.size }))); }; };
}), accountId);

/** Checks the database exists first: opening a missing one would create it empty and break the app's own open. */
const cachedOnce = (page: Page, accountId: string) => expect.poll(() => page.evaluate(async id => {
  const name = "myfarm-offline-" + id;
  if (!(await indexedDB.databases()).some(row => row.name === name)) return false;
  return new Promise<boolean>(resolve => {
    const open = indexedDB.open(name);
    open.onerror = () => resolve(false);
    open.onsuccess = () => {
      if (!open.result.objectStoreNames.contains("meta")) { open.result.close(); resolve(false); return; }
      const request = open.result.transaction("meta").objectStore("meta").get("lastSyncAt");
      request.onsuccess = () => { open.result.close(); resolve(Boolean(request.result)); };
      request.onerror = () => { open.result.close(); resolve(false); };
    };
  });
}, accountId), { timeout: 30_000 }).toBe(true);
async function seed(context: BrowserContext, base: string, farm: string) {
  const headers = { origin: base }, id = () => crypto.randomUUID(), suffix = id().slice(0, 8);
  const post = async (path: string, data: object) => { const r = await context.request.post(`${base}/api/v1/farms/${farm}/${path}`, { headers, data }); expect(r.status()).toBe(201); return r.json(); };
  const enterpriseName = "Offline maize " + suffix, plotName = "Offline plot " + suffix, storeName = "Offline store " + suffix;
  const { enterpriseId } = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await post("enterprises", { requestId: id(), name: enterpriseName, type: "CROP" })).enterprise;
  const { seasonId } = z.object({ season: z.object({ seasonId: z.uuid() }) }).parse(await post("seasons", { requestId: id(), label: "Offline season " + suffix, startDate: "2026-03-01" })).season;
  const { plotId } = z.object({ plotId: z.uuid() }).parse(await post("plots", { requestId: id(), name: plotName, area: "1", areaUnit: "ACRE" }));
  await post("crop-cycles", { requestId: id(), enterpriseId, seasonId, plotId, cropId: "f4030005-0000-4000-8000-000000000001", plantingDate: "2026-03-01", areaPlanted: "1", areaUnit: "ACRE" });
  await post("storage-locations", { requestId: id(), name: storeName });
  return { enterpriseName, plotName, storeName };
}
const optionValue = async (page: Page, label: string, text: string | RegExp) => {
  const value = await page.getByLabel(label, { exact: true }).locator("option").filter({ hasText: text }).first().getAttribute("value");
  if (!value) throw new Error("No option " + text);
  await page.getByLabel(label, { exact: true }).selectOption(value);
};

// These journeys start and stop a real server, so they need more than the default 30 seconds.
test.setTimeout(120_000);

test("MYF-P07-AC002 all eight actions work with the server stopped and survive a reload", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
  await server.start();
  try {
    const names = await seed(context, base, farm);
    await page.goto(base + "/farms");
    await page.waitForFunction(async () => !!(await caches.match("/offline")), undefined, { timeout: 20_000 });
    await cachedOnce(page, account);
    await page.goto(base + "/offline");
    await page.getByRole("button", { name: "Record expense" }).waitFor();
    await server.stop();

    const offline = await context.newPage();
    await page.close();
    await offline.goto(base + "/offline");
    await expect(offline.getByRole("button", { name: "Record expense" })).toBeVisible();
    await expect(offline.getByText("Entries waiting to send")).toBeVisible();
    await offline.getByLabel("Choose a farm", { exact: true }).selectOption(farm);

    await offline.getByRole("button", { name: "Record expense" }).click();
    await offline.getByRole("button", { name: "Save expense" }).click();
    await expect(offline.getByText("Enter what was it for?.")).toBeVisible();
    expect(await outbox(offline, account)).toHaveLength(0);
    await offline.getByLabel("What was it for?", { exact: true }).selectOption({ index: 1 });
    await offline.getByLabel("Amount", { exact: true }).fill("-5");
    await offline.getByRole("button", { name: "Save expense" }).click();
    await expect(offline.getByText("Enter an amount above 0")).toBeVisible();
    expect(await outbox(offline, account)).toHaveLength(0);
    await offline.getByLabel("Amount", { exact: true }).fill("150000");
    await optionValue(offline, "Enterprise (optional)", names.enterpriseName);
    await offline.getByRole("button", { name: "Save expense" }).click();
    await expect(offline.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();

    await offline.getByRole("button", { name: "Record income" }).click();
    await offline.getByLabel("What was it from?", { exact: true }).selectOption({ index: 1 });
    await offline.getByLabel("Amount", { exact: true }).fill("90000");
    await offline.getByRole("button", { name: "Save income" }).click();
    await expect(offline.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();

    await offline.getByRole("button", { name: "Record harvest" }).click();
    await offline.getByLabel("Crop cycle", { exact: true }).selectOption({ index: 1 });
    await optionValue(offline, "Store", names.storeName);
    await offline.getByLabel("Harvested kilograms", { exact: true }).fill("2400");
    await offline.getByLabel("Initial loss in kilograms", { exact: true }).fill("150");
    await offline.getByRole("button", { name: "Save harvest" }).click();
    await expect(offline.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();

    await offline.getByRole("button", { name: "Record activity" }).click();
    await optionValue(offline, "What is it for? (optional)", names.enterpriseName);
    await expect(offline.getByLabel("Activity", { exact: true }).getByRole("option", { name: "Feeding" })).toHaveCount(0);
    await offline.getByLabel("Activity", { exact: true }).selectOption("WEEDING");
    await offline.getByLabel("Worker name (optional)", { exact: true }).fill("Okello");
    await offline.getByRole("button", { name: "Save activity" }).click();
    await expect(offline.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();

    await offline.getByRole("button", { name: "Create task" }).click();
    await offline.getByLabel("Activity", { exact: true }).selectOption("INSPECTION");
    await offline.getByRole("button", { name: "Save task" }).click();
    await expect(offline.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();

    await offline.getByRole("button", { name: "Take photo" }).click();
    await offline.getByLabel("Attach to", { exact: true }).selectOption({ label: await offline.getByLabel("Attach to", { exact: true }).locator("option").filter({ hasText: "Activity done" }).first().innerText() });
    await offline.getByLabel("Photo", { exact: true }).setInputFiles({ name: "weeding.png", mimeType: "image/png", buffer: PNG });
    await offline.getByRole("button", { name: "Save photo" }).click();
    await expect(offline.getByText("Photo saved on this phone.")).toBeVisible();

    await offline.reload();
    await expect(offline.getByRole("button", { name: "Record expense" })).toBeVisible();
    await offline.getByLabel("Choose a farm", { exact: true }).selectOption(farm);
    await expect(offline.getByText("Entries waiting to send").locator("..").getByText("6", { exact: true })).toBeVisible();
    // Sending is attempted on opening, so an entry settles back to waiting with the server down. Its local version counts those attempts.
    await expect.poll(async () => (await outbox(offline, account)).every(row => row.syncStatus === "PENDING"), { timeout: 20_000 }).toBe(true);
    const entries = await outbox(offline, account);
    expect(entries.map(row => row.operation).sort()).toEqual(["ATTACH_PHOTO", "CREATE_TASK", "RECORD_ACTIVITY", "RECORD_EXPENSE", "RECORD_HARVEST", "RECORD_INCOME"]);
    for (const row of entries) expect(row).toMatchObject({ syncStatus: "PENDING", version: expect.any(Number), deviceId: entries[0].deviceId, createdAt: expect.any(String) });
    const photo = entries.find(row => row.operation === "ATTACH_PHOTO"), parent = entries.find(row => row.operation === "RECORD_ACTIVITY");
    expect(photo?.dependsOn).toBe(parent?.clientMutationId);
    const stored = await photos(offline, account);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ contentType: "image/jpeg", sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(stored[0].size).toBe(stored[0].byteSize);

    await offline.getByRole("button", { name: "View records" }).click();
    await expect(offline.getByText("Saved copies from")).toBeVisible();
    await expect(offline.getByRole("region", { name: "Records" }).getByText("Waiting to send", { exact: true })).toHaveCount(6);
    await offline.close();
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});

test("MYF-P07-AC001 a full phone says nothing was saved and keeps the farmer's input", async ({ page, context }) => {
  // Simulated: the browser's own storage call raises the real error type, because a real full disk cannot be arranged reliably here.
  await page.addInitScript(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["add"]>) {
      if ((window as unknown as { fullPhone?: boolean }).fullPhone && this.name === "outbox") throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return add.apply(this, args);
    };
  });
  const f = await prepareInventoryBrowser(), server = offlineServer(3103), base = server.baseURL, farm = f.farms.a, account = f.users.a;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: base, httpOnly: true, sameSite: "Lax" }]);
  await server.start();
  try {
    await seed(context, base, farm);
    await page.goto(base + "/farms");
    await cachedOnce(page, account);
    await page.goto(base + "/offline");
    await page.getByLabel("Choose a farm", { exact: true }).selectOption(farm);
    await page.getByRole("button", { name: "Record expense" }).click();
    await page.getByLabel("What was it for?", { exact: true }).selectOption({ index: 1 });
    await page.getByLabel("Amount", { exact: true }).fill("150000");

    await page.evaluate(() => { (window as unknown as { fullPhone?: boolean }).fullPhone = true; });
    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Not saved: this phone is out of space. Your details are still here.", { exact: false })).toBeVisible();
    await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("150000");
    await expect(page.getByText("Saved on this phone. It will send when you reconnect.")).toHaveCount(0);
    expect(await outbox(page, account)).toHaveLength(0);
    await page.evaluate(() => { (window as unknown as { fullPhone?: boolean }).fullPhone = false; });

    await page.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Saved on this phone. It will send when you reconnect.")).toBeVisible();
    expect(await outbox(page, account)).toHaveLength(1);
  } finally { await server.stop(); await clearInventoryBrowser(f); }
});
