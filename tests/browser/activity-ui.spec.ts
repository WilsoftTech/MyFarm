import { expect, test } from "../support/browser-test";
import { z } from "zod";
import { clearInventoryBrowser, prepareInventoryBrowser } from "../support/inventory-browser";

test("MYF-P06-AC001 schedules allowed activities, keeps input offline and states limits clearly", async ({ page, context }) => {
  const f = await prepareInventoryBrowser(), farm = f.farms.a;
  await context.addCookies([{ name: "sb-127-auth-token", value: f.accounts.a.cookie, url: "http://127.0.0.1:3102", httpOnly: true, sameSite: "Lax" }]);
  const headers = { origin: "http://127.0.0.1:3102" }, id = () => crypto.randomUUID();
  const enterprise = async (name: string, type: string) => {
    const response = await context.request.post(`/api/v1/farms/${farm}/enterprises`, { headers, data: { requestId: id(), name, type } });
    expect(response.status()).toBe(201);
    return z.object({ enterprise: z.object({ enterpriseId: z.uuid() }) }).parse(await response.json()).enterprise.enterpriseId;
  };
  const suffix = id().slice(0, 8), cropName = "Activity crop " + suffix, poultryName = "Activity layers " + suffix, fishName = "Activity fish " + suffix;
  try {
    const crop = await enterprise(cropName, "CROP"), poultry = await enterprise(poultryName, "POULTRY");
    await enterprise(fishName, "FISH");

    await page.goto(`/farms/${farm}/activities/new`);
    await expect(page.getByText(fishName + " — activities not available for this enterprise yet")).toBeVisible();
    await expect(page.getByRole("link", { name: fishName })).toHaveCount(0);

    await page.getByRole("link", { name: cropName }).click();
    await expect(page.getByRole("heading", { name: "Schedule activity" })).toBeVisible();
    const type = page.getByLabel("Activity", { exact: true });
    await expect(type.getByRole("option", { name: "Fertilizing", exact: true })).toBeEnabled();
    await expect(type.getByRole("option", { name: "Feeding — not for this enterprise" })).toBeDisabled();
    await expect(type.getByRole("option", { name: "Milking — not available yet" })).toBeDisabled();
    await type.selectOption("FERTILIZING");
    await page.getByLabel("Due date", { exact: true }).fill("2026-11-03");
    await context.setOffline(true);
    await expect(page.getByRole("button", { name: "Save activity" })).toBeDisabled();
    await expect(page.getByLabel("Due date", { exact: true })).toHaveValue("2026-11-03");
    await context.setOffline(false);
    await page.getByRole("button", { name: "Save activity" }).click();
    await expect(page.getByRole("heading", { name: "Fertilizing" })).toBeVisible();
    await expect(page.getByText(cropName, { exact: true })).toBeVisible();
    const activityId = page.url().split("/").pop();

    await page.goto(`/farms/${farm}/activities/new?for=${poultry}`);
    const poultryType = page.getByLabel("Activity", { exact: true });
    await expect(poultryType.getByRole("option", { name: "Vaccination", exact: true })).toBeEnabled();
    await expect(poultryType.getByRole("option", { name: "Planting — not for this enterprise" })).toBeDisabled();

    await page.goto(`/farms/${farm}/activities/new?for=farm`);
    await expect(page.getByText("The whole farm", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Activity", { exact: true }).getByRole("option", { name: "Inspection", exact: true })).toBeEnabled();

    const denied = await context.request.post(`/api/v1/farms/${farm}/activities`, { headers, data: { requestId: id(), type: "PLANTING", dueOn: "2026-11-03", enterpriseId: poultry } });
    expect(denied.status()).toBe(400);
    const list = await context.request.get(`/api/v1/farms/${farm}/activities`);
    expect(z.object({ items: z.array(z.object({ enterpriseId: z.uuid().nullable() })) }).parse(await list.json()).items.filter(row => row.enterpriseId === crop)).toHaveLength(1);

    expect((await context.request.get(`/api/v1/farms/${f.farms.a2}/activities/${activityId}`)).status()).toBe(403);
    expect((await context.request.get(`/api/v1/farms/${f.farms.b}/activities`)).status()).toBe(403);
    await page.goto(`/farms/${f.farms.b}/activities`);
    await expect(page).toHaveURL(/\/forbidden/);
  } finally { await clearInventoryBrowser(f); }
});
