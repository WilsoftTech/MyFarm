import { test, expect, type Page } from "../support/browser-test";
import { Client } from "pg";
import { z } from "zod";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "../support/production-browser-fixtures";
import { farmToday } from "@/modules/farm-activities/domain/activity";
import { addDays } from "@/modules/farm-activities/domain/recurrence";
let fixtures: ProductionBrowserFixtures, activityId: string, dueOn: string;
let seededActivityIds: string[] = [];
async function query(sql: string, values: unknown[] = []) {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
  try { return await db.query(sql, values); } finally { await db.end(); }
}
async function current() { return (await query('SELECT "dueOn"::text,version FROM "ProductionActivity" WHERE id=$1',[activityId])).rows[0]; }
async function check(page: Page) {
  await page.goto(`/farms/${fixtures.farms.a}/weather?activity=${activityId}`);
  await page.getByRole("button",{name:"Check test forecast",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Test forecast results"})).toBeVisible();
}
async function review(page: Page) {
  await check(page); await page.getByLabel("New activity date",{exact:true}).fill(addDays(dueOn,1));
  await page.getByRole("button",{name:"Review date change",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Check this date change"})).toBeVisible();
}
test.beforeEach(async ({ context }) => {
  fixtures=readProductionBrowserFixtures(); activityId=crypto.randomUUID(); dueOn=addDays(farmToday(new Date()),1);
  seededActivityIds=[activityId];
  await query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])',[Object.values(fixtures.sessions)]);
  await query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1',[fixtures.users.a]);
  await query('INSERT INTO "ProductionActivity" (id,"tenantId","farmId",type,"dueOn","createdBy","requestHash") VALUES ($1,$2,$3,\'SPRAYING\',$4,$5,$6)',[activityId,fixtures.tenants.a,fixtures.farms.a,dueOn,fixtures.users.a,activityId.replaceAll('-','').repeat(2)]);
  await context.addCookies([{ name:"sb-127-auth-token",value:fixtures.accounts.a.cookie,url:"http://127.0.0.1:3102",httpOnly:true,sameSite:"Lax",secure:false }]);
});
test.afterEach(async()=>{
  if (!fixtures || !seededActivityIds.length) return;
  await query('DELETE FROM "ProductionActivity" WHERE id=ANY($1::uuid[]) AND "farmId"=$2 AND "tenantId"=$3',[seededActivityIds,fixtures.farms.a,fixtures.tenants.a]);
  await query('DELETE FROM "AuditEvent" WHERE "targetId"=ANY($1::uuid[]) AND "tenantId"=$2 AND "actorId"=$3',[seededActivityIds,fixtures.tenants.a,fixtures.users.a]);
  seededActivityIds=[];
});
test("AC001/AC002 names the task/time and changes one date only after exact separate confirmation",async ({page}, info)=>{
  await review(page); expect((await current()).version).toBe(1);
  await expect(page.getByRole("button",{name:"Confirm date change",exact:true})).toBeDisabled();
  await expect(page.getByText(/Test forecast: rain is expected/)).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty("scrollWidth",await page.locator("html").evaluate(el=>el.clientWidth));
  await page.screenshot({path:`.cache/p13-weather-${info.project.name}.png`,fullPage:true});
  await page.getByRole("checkbox").focus(); await page.keyboard.press("Space");
  await page.getByRole("button",{name:"Confirm date change",exact:true}).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading",{name:"Date change saved"})).toBeVisible();
  expect(await current()).toMatchObject({dueOn:addDays(dueOn,1),version:2});
  expect((await query('SELECT count(*)::int n FROM "AuditEvent" WHERE "targetId"=$1 AND action LIKE \'WEATHER_MOVE:%\'',[activityId])).rows[0].n).toBe(1);
  await page.getByRole("link",{name:"Open saved activity"}).click(); await expect(page.getByText(addDays(dueOn,1),{exact:true})).toBeVisible();
});
test("all six capabilities use synthetic fixtures and provider failure makes no weather claim",async ({page})=>{
  await check(page);
  for(const scenario of ["PLANTING","IRRIGATION","EXTREME","NONE","UNAVAILABLE"]){
    await page.getByLabel("Test scenario",{exact:true}).selectOption(scenario); await page.getByRole("button",{name:"Check test forecast",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Test forecast results"})).toBeVisible();
    await expect(page.getByRole("region",{name:"Test forecast results"}).getByRole("listitem")).toHaveCount(6);
  }
  await expect(page.getByText("No current forecast is available.",{exact:true})).toBeVisible(); expect((await current()).version).toBe(1);
});
test("editing a reviewed date clears consent and discarding makes no change",async ({page})=>{
  await review(page); await page.getByRole("checkbox").check();
  await page.getByLabel("New activity date",{exact:true}).fill(addDays(dueOn,2));
  await expect(page.getByRole("heading",{name:"Check this date change"})).toHaveCount(0);
  await page.getByRole("button",{name:"Review date change",exact:true}).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button",{name:"Discard review",exact:true}).click(); expect((await current()).version).toBe(1);
});
test("a lost response retries the same confirmation without a second date move",async ({page})=>{
  await review(page); await page.route("**/weather/confirm",async route=>{await route.fetch();await route.abort("failed");},{times:1});
  await page.getByRole("checkbox").check(); await page.getByRole("button",{name:"Confirm date change",exact:true}).click();
  await expect(page.getByRole("button",{name:"Retry this confirmation"})).toBeVisible(); expect((await current()).version).toBe(2);
  await page.getByRole("button",{name:"Retry this confirmation"}).click();
  await expect(page.getByRole("heading",{name:"Date change saved"})).toBeVisible();expect((await current()).version).toBe(2);
});
test("revocation after review refuses the move",async ({page})=>{
  await review(page); await query('UPDATE "FarmMember" SET status=\'REVOKED\' WHERE "farmId"=$1 AND "userId"=$2',[fixtures.farms.a,fixtures.users.a]);
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Confirm date change",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"Your access"})).toBeVisible();expect((await current()).version).toBe(1);
});
test("expired review disables confirmation",async ({page})=>{
  await page.clock.install();await review(page);await page.getByRole("checkbox").check();await page.clock.fastForward(16*60_000);
  await expect(page.getByText(/This test forecast expired/)).toBeVisible();await expect(page.getByRole("button",{name:"Confirm date change",exact:true})).toBeDisabled();expect((await current()).version).toBe(1);
});
test("a revoked session after review cannot confirm",async ({page})=>{
  await review(page);await query('UPDATE auth.sessions SET not_after=clock_timestamp()-interval \'1 second\' WHERE id=$1',[fixtures.sessions.a]);
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Confirm date change",exact:true}).click();
  await expect(page.getByRole("alert")).toBeVisible();expect((await current()).version).toBe(1);
});
test("offline check is explicit and never queues a date move",async ({page,context})=>{
  await check(page);await context.setOffline(true);await page.getByRole("button",{name:"Check test forecast",exact:true}).click();
  await expect(page.getByRole("alert").filter({hasText:"offline"})).toBeVisible();expect((await current()).version).toBe(1);await context.setOffline(false);
});
test("another farm and nested activity cannot be read through the weather endpoint",async ({page})=>{
  await check(page);
  for (const farmId of [fixtures.farms.a2,fixtures.farms.b]) {
    const response=await page.request.post(`/api/v1/farms/${farmId}/weather/check`,{headers:{origin:"http://127.0.0.1:3102"},data:{scenario:"RAIN",activityId,cycleId:null,stage:null}});
    expect(response.status()).toBe(403);
  }
});
test("an older selected activity remains available through paged choices",async ({page})=>{
  const added=await query('INSERT INTO "ProductionActivity" (id,"tenantId","farmId",type,"dueOn","createdBy","requestHash") SELECT gen_random_uuid(),$1,$2,\'SPRAYING\',$3,$4,\'weather-page-fixture\' FROM generate_series(1,52) RETURNING id',[fixtures.tenants.a,fixtures.farms.a,dueOn,fixtures.users.a]);
  seededActivityIds.push(...z.array(z.object({id:z.uuid()})).parse(added.rows).map(row=>row.id));
  await check(page);await expect(page.getByLabel("Planned activity",{exact:true})).toHaveValue(activityId);
  await page.getByRole("navigation",{name:"Activity choices pages"}).getByRole("link",{name:"More records"}).click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(page.getByRole("navigation",{name:"Activity choices pages"}).getByRole("link",{name:"First page"})).toBeVisible();
  await expect(page.getByLabel("Planned activity",{exact:true})).toHaveValue(activityId);
  await page.getByRole("button",{name:"Check test forecast",exact:true}).click();await expect(page.getByText(/Test forecast: rain is expected/)).toBeVisible();
});
