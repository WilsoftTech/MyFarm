import { it,expect } from "vitest";
import { Client } from "pg";
import { readFileSync,readdirSync } from "node:fs";
it("all Phase 5 migrations roll back atomically and retain earlier identity data",async()=>{
 const url=process.env.TEST_DATABASE_URL;if(!url||!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url))throw new Error("Isolated database required");
 const name="myfarm_p05_upgrade_"+crypto.randomUUID().replaceAll("-","");const target=new URL(url);target.pathname="/"+name;
 const admin=new Client({connectionString:url});await admin.connect();await admin.query('CREATE DATABASE "'+name+'"');
 const db=new Client({connectionString:target.toString()});await db.connect();
 const layout=async()=>JSON.stringify({columns:(await db.query("SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY 1,2")).rows,indexes:(await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname")).rows,constraints:(await db.query("SELECT conname,pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname")).rows});
 const actor=crypto.randomUUID(),subject=crypto.randomUUID();let seeded=false;
 try{
  const migrations=readdirSync("prisma/migrations").filter(n=>/^\d/.test(n)).sort();
  for(const name of migrations){const sql=readFileSync("prisma/migrations/"+name+"/migration.sql","utf8");
   if(name.startsWith("20261029")){if(!seeded){await db.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)',[actor,subject]);seeded=true;}const before=await layout();await expect(db.query(sql.replace(/COMMIT;\s*$/,"SELECT 1/0; COMMIT;"))).rejects.toMatchObject({code:"22012"});await db.query("ROLLBACK");expect(await layout()).toBe(before);}
   await db.query(sql);
  }
  expect((await db.query('SELECT "authSubject" FROM "User" WHERE id=$1',[actor])).rows).toEqual([{authSubject:subject}]);
  // Even as owner, NaN is rejected by finite checks before any missing FK can accept it.
  await expect(db.query('INSERT INTO "ProductionEvent" (id,"tenantId","farmId","batchId","locationId",type,quantity,unit,"occurredOn","requestHash","createdBy") VALUES ($1,$2,$3,$4,$5,\'PURCHASE\',\'NaN\',\'BIRD\',\'2026-10-01\',$6,$7)',[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID(),"0".repeat(64),crypto.randomUUID()])).rejects.toMatchObject({code:"23514"});
 }finally{await db.end();await admin.query('DROP DATABASE "'+name+'"');await admin.end();}
},30_000);
