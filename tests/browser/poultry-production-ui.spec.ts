import { test, expect } from "@playwright/test";
import { z } from "zod";
import {prepareInventoryBrowser,clearInventoryBrowser} from "../support/inventory-browser";
test("source flock reconstructs 105 birds after purchase, mortality and an atomic sale", async ({page, context}) => {
 const f=await prepareInventoryBrowser(), farm=f.farms.a, id=()=>crypto.randomUUID();
 await context.addCookies([{name:"sb-127-auth-token",value:f.accounts.a.cookie,url:"http://127.0.0.1:3102",httpOnly:true,sameSite:"Lax"}]);
 const post=async(path:string,data:object)=>{const r=await context.request.post(`/api/v1/farms/${farm}/${path}`,{headers:{origin:"http://127.0.0.1:3102"},data});expect(r.status()).toBe(201);return r.json();};
 try {
  const e=z.object({enterprise:z.object({enterpriseId:z.uuid()})}).parse(await post("enterprises",{requestId:id(),name:"Poultry "+id(),type:"POULTRY"})).enterprise;
  const b=z.object({batch:z.object({batchId:z.uuid()})}).parse(await post("poultry-batches",{requestId:id(),enterpriseId:e.enterpriseId,animalTypeId:"f4030008-0000-4000-8000-000000000004",batchLabel:"Production "+id(),startingQuantity:100,acquisitionDate:"2026-03-01",purpose:"DUAL_PURPOSE"})).batch;
  const l=z.object({location:z.object({storageLocationId:z.uuid()})}).parse(await post("storage-locations",{requestId:id(),name:"Housing "+id()})).location;
  await page.goto(`/farms/${farm}/poultry-production/new`);
  await page.getByLabel("Poultry batch",{exact:true}).selectOption(b.batchId);
  await page.getByLabel("Store or flock housing",{exact:true}).selectOption(l.storageLocationId);
  await page.getByLabel("Event",{exact:true}).selectOption("PURCHASE");
  await page.getByLabel("Quantity",{exact:true}).fill("20");
  await page.getByLabel("Event date",{exact:true}).fill("2026-10-01");
  await page.getByRole("button",{name:"Save poultry event"}).click();
  await expect(page.getByText("Current birds: 120",{exact:true})).toBeVisible();
  await post("poultry-production",{requestId:id(),batchId:b.batchId,locationId:l.storageLocationId,type:"MORTALITY",quantity:"5",unit:"BIRD",occurredOn:"2026-10-01"});
  const categories=await context.request.get(`/api/v1/farms/${farm}/accounting/categories?kind=REVENUE`);
  const category=z.object({items:z.array(z.object({categoryId:z.uuid()}))}).parse(await categories.json()).items[0];
  await post("poultry-production",{requestId:id(),batchId:b.batchId,locationId:l.storageLocationId,type:"BIRD_SALE",quantity:"10",unit:"BIRD",occurredOn:"2026-10-01",sale:{categoryId:category.categoryId,amount:"200000",currency:"UGX"}});
  await page.reload(); await expect(page.getByText("Current birds: 105",{exact:true})).toBeVisible();
  await page.goto(`/farms/${farm}/poultry-batches/${b.batchId}`);await expect(page.getByText("105 birds",{exact:true})).toBeVisible();
 } finally {
  await clearInventoryBrowser(f);
 }
});
