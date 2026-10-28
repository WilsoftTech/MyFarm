import { Client } from "pg";
import { readProductionBrowserFixtures, type ProductionBrowserFixtures } from "./production-browser-fixtures";

function browserDatabase() {
 const url=process.env.TEST_DATABASE_URL;
 if(!url||!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url))throw new Error("Browser fixtures require isolated loopback database");
 return new Client({connectionString:url});
}
/** Earlier acceptance cases deliberately revoke membership and expire sessions. */
export async function prepareInventoryBrowser() {
 const f=readProductionBrowserFixtures(),db=browserDatabase();await db.connect();
 try{
  await db.query('UPDATE auth.sessions SET not_after=NULL WHERE id=ANY($1::uuid[])',[Object.values(f.sessions)]);
  await db.query('UPDATE "FarmMember" SET status=\'ACTIVE\' WHERE "userId"=$1',[f.users.a]);
 }finally{await db.end();}
 return f;
}
/** Clear only generated fixture-tenant data, in reverse dependency order. */
export async function clearInventoryBrowser(f:ProductionBrowserFixtures) {
 const db=browserDatabase();await db.connect();
 try{
  for(const table of ["StockMovement","StockAdjustment","StockOperation","ProductionEvent","Harvest","InventoryItem","StorageLocation","AccountingReversal","PaymentAllocation","PaymentRecord","AccountingRecord"])
   await db.query('DELETE FROM "'+table+'" WHERE "tenantId"=$1',[f.tenants.a]);
 }finally{await db.end();}
}
