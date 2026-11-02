import { expect, test } from "@playwright/test";
import { z } from "zod";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";

const kampalaDate = (offsetDays: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));

test("MYF-P06-AC003 repeating feeding creates one activity per date and stopping ends future entries", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), farm = f.farms.a;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]);
  const headers = { origin: "http://127.0.0.1:3102" }, id = () => crypto.randomUUID();
  const suffix = id().slice(0, 8), flock = "Layers " + suffix;
  const upcoming = async (seriesId: string) => {
    const rows: string[] = [];
    let cursor: string | null = null;
    do {
      const response = await context.request.get(`/api/v1/farms/${farm}/activities?recurrenceId=${seriesId}&bucket=UPCOMING&limit=50${cursor ? "&cursor=" + cursor : ""}`);
      const body: { items: { dueOn: string }[]; nextCursor: string | null } = z.object({ items: z.array(z.object({ dueOn: z.string() })), nextCursor: z.uuid().nullable() }).parse(await response.json());
      rows.push(...body.items.map(item => item.dueOn));
      cursor = body.nextCursor;
    } while (cursor);
    return rows;
  };
  try {
    const created = await context.request.post(`/api/v1/farms/${farm}/enterprises`, { headers, data: { requestId: id(), name: flock, type: "POULTRY" } });
    const { enterpriseId } = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await created.json()).enterprise;

    await page.goto(`/farms/${farm}/activities/series/new`);
    await page.getByRole("link", { name: flock }).click();
    const type = page.getByLabel("Activity", { exact: true });
    await expect(type.getByRole("option", { name: "Feeding", exact: true })).toBeEnabled();
    await expect(type.getByRole("option", { name: "Milking — not available yet" })).toBeDisabled();
    await expect(type.getByRole("option", { name: /Weeding/ })).toHaveCount(0);
    await type.selectOption("FEEDING");
    await page.getByLabel("Period", { exact: true }).selectOption("DAILY");
    await page.getByLabel("First due date", { exact: true }).fill(kampalaDate(1));
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Start repeating" })).toBeDisabled();
    await expect(page.getByLabel("First due date", { exact: true })).toHaveValue(kampalaDate(1));
    await context.setOffline(false);
    await page.getByRole("button", { name: "Start repeating" }).click();
    await expect(page.getByRole("heading", { name: "Repeating feeding" })).toBeVisible();
    await expect(page.getByText("Every day", { exact: true })).toBeVisible();
    const seriesId = page.url().split("/").pop() as string;

    const first = await upcoming(seriesId);
    expect(first).toHaveLength(30);
    expect(new Set(first).size).toBe(30);
    for (const path of ["activities", "activities?bucket=UPCOMING", "activities/calendar", `activities/series/${seriesId}`]) await page.goto(`/farms/${farm}/${path}`);
    expect((await context.request.post(`/api/v1/farms/${farm}/activity-series/expand`, { headers, data: {} })).status()).toBe(200);
    expect(await upcoming(seriesId)).toEqual(first);

    const month = kampalaDate(1).slice(0, 7);
    await page.goto(`/farms/${farm}/activities/calendar?month=${month}`);
    await expect(page.getByRole("heading", { name: kampalaDate(1), exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
    await expect(page.getByRole("heading", { name: /^Calendar / })).toBeVisible();

    await page.goto(`/farms/${farm}/activities/series/${seriesId}`);
    await page.getByRole("link", { name: kampalaDate(2), exact: true }).click();
    await page.getByRole("checkbox", { name: "I want to cancel this activity." }).check();
    await page.getByRole("button", { name: "Cancel activity" }).click();
    await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
    expect(await upcoming(seriesId)).not.toContain(kampalaDate(2));

    await page.goto(`/farms/${farm}/activities/series/${seriesId}`);
    await page.getByLabel("Change from", { exact: true }).fill(kampalaDate(7));
    await page.getByLabel("Period", { exact: true }).selectOption("WEEKLY");
    await page.getByRole("button", { name: "Save change" }).click();
    await expect(page.getByText("Every week", { exact: true })).toBeVisible();
    const changedId = page.url().split("/").pop() as string;
    expect(changedId).not.toBe(seriesId);
    expect(await upcoming(changedId)).toContain(kampalaDate(7));
    expect((await upcoming(seriesId)).every(date => date < kampalaDate(7))).toBe(true);

    await page.getByLabel("Stop from", { exact: true }).fill(kampalaDate(14));
    await page.getByRole("checkbox", { name: "I want to stop this repeating activity." }).check();
    await page.getByRole("button", { name: "Stop repeating" }).click();
    await expect(page.getByText("Stopped from", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save change" })).toHaveCount(0);
    expect(await upcoming(changedId)).toEqual([kampalaDate(7)]);

    expect((await context.request.post(`/api/v1/farms/${farm}/activity-series`, { headers, data: { requestId: id(), type: "WEEDING", frequency: "DAILY", interval: 1, startOn: kampalaDate(1) } })).status()).toBe(400);
    expect((await context.request.post(`/api/v1/farms/${farm}/activity-series`, { headers, data: { requestId: id(), type: "FEEDING", frequency: "DAILY", interval: 1, startOn: kampalaDate(1), enterpriseId, tenantId: f.tenants.a } })).status()).toBe(400);
    expect((await context.request.get(`/api/v1/farms/${f.farms.a2}/activity-series/${seriesId}`)).status()).toBe(403);
    expect((await context.request.get(`/api/v1/farms/${f.farms.b}/activity-series`)).status()).toBe(403);
    await page.goto(`/farms/${f.farms.b}/activities/series/${seriesId}`);
    await expect(page).toHaveURL(/\/forbidden/);
    await page.goto(`/farms/${farm}/activities/calendar?month=2026-13`);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  } finally { await clearInventoryBrowser(f); }
});
