import { expect, test } from "../support/browser-test";
import { z } from "zod";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";

const kampalaDate = (offsetDays: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kampala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + offsetDays * 86_400_000));

test("MYF-P06-AC002 Plot B fertilizer due tomorrow is upcoming, and completion records the worker and time", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), farm = f.farms.a;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]);
  const headers = { origin: "http://127.0.0.1:3102" }, id = () => crypto.randomUUID();
  const post = async (path: string, data: object) => { const r = await context.request.post(`/api/v1/farms/${farm}/${path}`, { headers, data }); expect(r.status()).toBe(201); return r.json(); };
  const suffix = id().slice(0, 8), plotName = "Plot B " + suffix, cropName = "Maize " + suffix;
  try {
    const { enterpriseId } = z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await post("enterprises", { requestId: id(), name: cropName, type: "CROP" })).enterprise;
    const { plotId } = z.object({ plotId: z.uuid() }).parse(await post("plots", { requestId: id(), name: plotName, area: "1", areaUnit: "ACRE" }));
    const categories = z.object({ items: z.array(z.object({ categoryId: z.uuid(), name: z.string() })) }).parse(await (await context.request.get(`/api/v1/farms/${farm}/accounting/categories?kind=COST`)).json());
    const expense = z.object({ record: z.object({ recordId: z.uuid() }) }).parse(await post("accounting/expenses", { requestId: id(), categoryId: categories.items[0].categoryId, amount: "150000", currency: "UGX", occurredOn: kampalaDate(0), paymentMethodId: z.object({ items: z.array(z.object({ paymentMethodId: z.uuid() })) }).parse(await (await context.request.get(`/api/v1/farms/${farm}/accounting/payment-methods`)).json()).items[0].paymentMethodId })).record;

    await page.goto(`/farms/${farm}/activities/new?for=${enterpriseId}`);
    await page.getByLabel("Activity", { exact: true }).selectOption("FERTILIZING");
    await page.getByLabel("Due date", { exact: true }).fill(kampalaDate(1));
    await page.getByLabel("Plot (optional)", { exact: true }).selectOption(plotId);
    await page.getByRole("button", { name: "Save activity" }).click();
    await expect(page.getByRole("heading", { name: "Fertilizing" })).toBeVisible();
    await expect(page.getByText("Upcoming", { exact: true })).toBeVisible();
    const activityId = page.url().split("/").pop();

    await page.goto(`/farms/${farm}/activities?bucket=UPCOMING`);
    await expect(page.getByRole("link", { name: "Upcoming" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(`Due ${kampalaDate(1)} · ${cropName} · ${plotName}`)).toBeVisible();
    await page.goto(`/farms/${farm}/activities`);
    await expect(page.getByText(`Due ${kampalaDate(1)} · ${cropName} · ${plotName}`)).toHaveCount(0);

    await page.goto(`/farms/${farm}/activities/${activityId}`);
    await page.getByLabel("Worker name (optional)", { exact: true }).fill("Okello");
    await page.getByLabel("Cost from money records (optional)", { exact: true }).selectOption(expense.recordId);
    await page.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("Okello", { exact: true })).toBeVisible();
    await expect(page.getByText(/Kampala time$/)).toBeVisible();
    await expect(page.getByText("150000 UGX", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark as done" })).toHaveCount(0);
    await page.goto(`/farms/${farm}/activities?bucket=COMPLETED`);
    await expect(page.getByText("Worker: Okello")).toBeVisible();

    const missed = z.object({ activity: z.object({ activityId: z.uuid() }) }).parse(await post("activities", { requestId: id(), type: "WEEDING", dueOn: kampalaDate(-1), enterpriseId })).activity;
    await page.goto(`/farms/${farm}/activities?bucket=MISSED`);
    await page.getByRole("link", { name: "Weeding" }).click();
    await expect(page).toHaveURL(new RegExp(missed.activityId));
    await page.getByLabel("Why it was cancelled (optional)", { exact: true }).fill("Rain");
    await page.getByRole("checkbox", { name: "I want to cancel this activity." }).check();
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Cancel activity" })).toBeDisabled();
    await expect(page.getByLabel("Why it was cancelled (optional)", { exact: true })).toHaveValue("Rain");
    await context.setOffline(false);
    await page.getByRole("button", { name: "Cancel activity" }).click();
    await expect(page.getByText("Rain", { exact: true })).toBeVisible();
    await page.goto(`/farms/${farm}/activities?bucket=CANCELLED`);
    await expect(page.getByRole("link", { name: "Weeding" })).toBeVisible();
    await page.goto(`/farms/${farm}/activities?bucket=MISSED`);
    await expect(page.getByText("No missed activities.")).toBeVisible();

    expect((await context.request.post(`/api/v1/farms/${farm}/activities/${activityId}/complete`, { headers, data: { requestId: id(), expectedVersion: 1 } })).status()).toBe(409);
    expect((await context.request.get(`/api/v1/farms/${f.farms.b}/activities/${activityId}`)).status()).toBe(403);
    await page.goto(`/farms/${farm}/activities?bucket=OVERDUE`);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  } finally { await clearInventoryBrowser(f); }
});
