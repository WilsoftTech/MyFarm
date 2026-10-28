// Real dump/restore on an explicitly isolated loopback test database; no hosted targets.
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
const url=process.env.TEST_DATABASE_URL;
if(!url||!/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url))throw new Error("Recovery requires isolated loopback test database");
const connection=new URL(url),container=process.env.MYFARM_TEST_CONTAINER;
if(container&&!/^[a-zA-Z0-9_-]+$/.test(container))throw new Error("Invalid test container");
const bin=process.env.MYFARM_TEST_PG_BIN;
if(!container&&!bin)throw new Error("Set the local PostgreSQL bin directory or disposable test container");
function pg(program,database,args,input){
 if(container)return execFileSync("docker",["exec",...(input?["-i"]:[]),container,program,"-U",decodeURIComponent(connection.username),"-d",database,...args],{input,maxBuffer:64*1024*1024});
 return execFileSync(path.join(bin,program+(process.platform==="win32"?".exe":"")),["-h",connection.hostname,"-p",connection.port,"-U",decodeURIComponent(connection.username),"-d",database,...args],{input,maxBuffer:64*1024*1024,env:{...process.env,PGPASSWORD:decodeURIComponent(connection.password)}});
}
const source=new Client({connectionString:url}),restoreName="myfarm_p05_restore_"+randomUUID().replaceAll("-","");
const restoreUrl=new URL(url);restoreUrl.pathname="/"+restoreName;
const restored=new Client({connectionString:restoreUrl.toString()});
const user=randomUUID(),tenant=randomUUID(),farmer=randomUUID(),farm=randomUUID(),location=randomUUID(),item=randomUUID(),operation=randomUUID();
let created=false,connected=false;
const snapshot=async db=>({rows:(await db.query(`SELECT i.name,i.unit,(SELECT sum("quantityDelta")::text FROM "StockMovement" WHERE "itemId"=i.id) AS balance,
(SELECT count(*)::int FROM "StockAdjustment" WHERE "tenantId"=$1) AS adjustments,
(SELECT count(*)::int FROM "AuditEvent" WHERE "tenantId"=$1) AS audits FROM "InventoryItem" i WHERE i.id=$2`,[tenant,item])).rows,
grants:(await db.query(`SELECT has_table_privilege('myfarm_runtime','"StockMovement"','INSERT') AS insert,
has_table_privilege('myfarm_runtime','"StockMovement"','UPDATE') AS update,
has_table_privilege('myfarm_runtime','"StockMovement"','DELETE') AS delete,
has_table_privilege('authenticated','"StockMovement"','SELECT') AS browser`)).rows,
policies:(await db.query("SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY 1,2")).rows});
await source.connect();
try{
 await source.query("BEGIN");
 await source.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)',[user,randomUUID()]);
 await source.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Recovery\',\'PERSONAL\')',[tenant]);
 await source.query('INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,\'FARMER\')',[user,tenant]);
 await source.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)',[farmer,user,tenant]);
 await source.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Recovery farm\',\'Rukungiri\',\'OWNED\',\'CROPS\',$4)',[farm,tenant,farmer,user]);
 await source.query('INSERT INTO "FarmMember" ("farmId","tenantId","userId",role) VALUES ($1,$2,$3,\'OWNER\')',[farm,tenant,user]);
 await source.query('INSERT INTO "StorageLocation" (id,"tenantId","farmId",name,"nameKey","createdBy") VALUES ($1,$2,$3,\'Recovery store\',\'recovery store\',$4)',[location,tenant,farm,user]);
 await source.query('INSERT INTO "InventoryItem" (id,"tenantId","farmId",name,"nameKey",kind,unit,"createdBy") VALUES ($1,$2,$3,\'Recovery stock\',\'recovery stock\',\'SUPPLY\',\'KG\',$4)',[item,tenant,farm,user]);
 await source.query('INSERT INTO "StockOperation" (id,"tenantId","farmId",type,"itemId","locationId",quantity,unit,"occurredOn",direction,reason,"requestHash","createdBy") VALUES ($1,$2,$3,\'ADJUSTMENT\',$4,$5,999999999999.999999,\'KG\',\'2026-10-01\',\'IN\',\'Opening stock\',$6,$7)',[operation,tenant,farm,item,location,"0".repeat(64),user]);
 await source.query('INSERT INTO "StockAdjustment" (id,"tenantId","farmId","operationId",reason,"approvedBy","createdBy") VALUES ($1,$2,$3,$4,\'Opening stock\',$5,$5)',[randomUUID(),tenant,farm,operation,user]);
 await source.query('INSERT INTO "StockMovement" (id,"tenantId","farmId","itemId","locationId","stockOperationId","quantityDelta",reason,"sourceKey","occurredOn","createdBy") VALUES ($1,$2,$3,$4,$5,$6,999999999999.999999,\'ADJUSTMENT_IN\',$7,\'2026-10-01\',$8)',[randomUUID(),tenant,farm,item,location,operation,"recovery:"+operation,user]);
 await source.query('INSERT INTO "AuditEvent" (id,"tenantId","actorId",action,"targetId","requestId") VALUES ($1,$2,$3,\'STOCK_OPERATION_POSTED\',$4,$5)',[randomUUID(),tenant,user,operation,randomUUID()]);
 await source.query("COMMIT");
 const before=await snapshot(source);if(before.rows[0]?.balance!=="999999999999.999999")throw new Error("Recovery fixture missing");
 const dump=pg("pg_dump","myfarm_phase01_test",["-Fc"]);
 await source.query('CREATE DATABASE "'+restoreName+'"');created=true;
 pg("pg_restore",restoreName,["--exit-on-error"],dump);await restored.connect();connected=true;
 if(JSON.stringify(await snapshot(restored))!==JSON.stringify(before))throw new Error("Restored stock, approval, audit or permission state differs");
 const duplicate=await restored.query('INSERT INTO "StockAdjustment" (id,"tenantId","farmId","operationId",reason,"approvedBy","createdBy") VALUES ($1,$2,$3,$4,\'Again\',$5,$5)',[randomUUID(),tenant,farm,operation,user]).then(()=>"accepted",e=>e.code);
 if(duplicate!=="23505")throw new Error("Restored approval uniqueness failed");
 console.log("PASS: real dump/restore retains exact maximum stock, immutable operation/approval/audit provenance, unique approval, RLS and runtime/browser grants.");
}finally{
 if(connected)await restored.end();if(created)await source.query('DROP DATABASE "'+restoreName+'"');await source.query("ROLLBACK");
 await source.query("BEGIN");for(const table of ["StockMovement","StockAdjustment","StockOperation","InventoryItem","StorageLocation","AuditEvent","FarmMember","Farm","Farmer"])await source.query('DELETE FROM "'+table+'" WHERE "tenantId"=$1',[tenant]);
 await source.query('DELETE FROM "Membership" WHERE "userId"=$1',[user]);await source.query('DELETE FROM "Organization" WHERE id=$1',[tenant]);await source.query('DELETE FROM "User" WHERE id=$1',[user]);await source.query("COMMIT");await source.end();
}
