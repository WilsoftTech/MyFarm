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
const source=new Client({connectionString:url}),restoreName="myfarm_p06_restore_"+randomUUID().replaceAll("-","");
const restoreUrl=new URL(url);restoreUrl.pathname="/"+restoreName;
const restored=new Client({connectionString:restoreUrl.toString()});
const user=randomUUID(),tenant=randomUUID(),farmer=randomUUID(),farm=randomUUID(),series=randomUUID(),category=randomUUID(),cost=randomUUID();
let created=false,connected=false;
const snapshot=async db=>({rows:(await db.query(`SELECT a."dueOn"::text,a.status,a."workerName",a."completedBy",a."recurrenceId",a."cancelReason",r.amount::text AS cost,r.currency FROM "ProductionActivity" a LEFT JOIN "AccountingRecord" r ON r.id=a."costRecordId" WHERE a."tenantId"=$1 ORDER BY a."dueOn"`,[tenant])).rows,
series:(await db.query(`SELECT frequency,"interval","startOn"::text,"stoppedFrom"::text,version FROM "ActivityRecurrence" WHERE "tenantId"=$1`,[tenant])).rows,
audits:(await db.query(`SELECT count(*)::int AS n FROM "AuditEvent" WHERE "tenantId"=$1`,[tenant])).rows,
grants:(await db.query(`SELECT has_table_privilege('myfarm_runtime','"ProductionActivity"','INSERT') AS insert,
has_column_privilege('myfarm_runtime','"ProductionActivity"','status','UPDATE') AS finish,
has_column_privilege('myfarm_runtime','"ProductionActivity"','dueOn','UPDATE') AS "rewriteDueOn",
has_table_privilege('myfarm_runtime','"ProductionActivity"','DELETE') AS delete,
has_table_privilege('authenticated','"ProductionActivity"','SELECT') AS browser,
has_table_privilege('authenticated','"ActivityRecurrence"','SELECT') AS "browserSeries"`)).rows,
policies:(await db.query("SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('ProductionActivity','ActivityRecurrence') ORDER BY 1,2")).rows,
rls:(await db.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('ProductionActivity','ActivityRecurrence') ORDER BY 1")).rows});
const activity=(status,dueOn,extra={})=>({id:randomUUID(),status,dueOn,workerName:null,completedAt:null,completedBy:null,cancelledAt:null,cancelledBy:null,cancelReason:null,costRecordId:null,...extra});
await source.connect();
try{
 await source.query("BEGIN");
 await source.query('INSERT INTO "User" (id,"authSubject") VALUES ($1,$2)',[user,randomUUID()]);
 await source.query('INSERT INTO "Organization" (id,name,kind) VALUES ($1,\'Recovery\',\'PERSONAL\')',[tenant]);
 await source.query('INSERT INTO "Membership" ("userId","organizationId",role) VALUES ($1,$2,\'FARMER\')',[user,tenant]);
 await source.query('INSERT INTO "Farmer" (id,"userId","tenantId") VALUES ($1,$2,$3)',[farmer,user,tenant]);
 await source.query('INSERT INTO "Farm" (id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES ($1,$2,$3,\'Recovery farm\',\'Rukungiri\',\'OWNED\',\'CROPS\',$4)',[farm,tenant,farmer,user]);
 await source.query('INSERT INTO "FarmMember" ("farmId","tenantId","userId",role) VALUES ($1,$2,$3,\'OWNER\')',[farm,tenant,user]);
 const seeded=(await source.query(`SELECT id,name FROM "TransactionCategory" WHERE kind='COST' ORDER BY id LIMIT 1`)).rows[0];
 await source.query('INSERT INTO "AccountingRecord" (id,"tenantId","farmId",kind,"categoryId","categoryName",amount,currency,"occurredOn","createdBy") VALUES ($1,$2,$3,\'EXPENSE\',$4,$5,150000.0000,\'UGX\',\'2026-11-01\',$6)',[cost,tenant,farm,seeded?.id??category,seeded?.name??"Seeds",user]);
 await source.query('INSERT INTO "ActivityRecurrence" (id,"tenantId","farmId",type,frequency,"interval","startOn","stoppedFrom","expandedThrough","requestHash","createdBy",version) VALUES ($1,$2,$3,\'FEEDING\',\'DAILY\',1,\'2026-11-02\',\'2026-11-05\',\'2026-12-02\',\'x\',$4,2)',[series,tenant,farm,user]);
 for(const row of [
  activity("COMPLETED","2026-11-02",{workerName:"Okello",completedAt:new Date("2026-11-02T09:00:00Z"),completedBy:user,costRecordId:cost}),
  activity("SCHEDULED","2026-11-03"),
  activity("CANCELLED","2026-11-05",{cancelledAt:new Date("2026-11-02T10:00:00Z"),cancelledBy:user,cancelReason:"Series stopped"}),
 ])await source.query('INSERT INTO "ProductionActivity" (id,"tenantId","farmId",type,"dueOn",status,"workerName","completedAt","completedBy","cancelledAt","cancelledBy","cancelReason","costRecordId","recurrenceId","requestHash","createdBy") VALUES ($1,$2,$3,\'FEEDING\',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,\'x\',$14)',[row.id,tenant,farm,row.dueOn,row.status,row.workerName,row.completedAt,row.completedBy,row.cancelledAt,row.cancelledBy,row.cancelReason,row.costRecordId,series,user]);
 await source.query('INSERT INTO "AuditEvent" (id,"tenantId","actorId",action,"targetId","requestId") VALUES ($1,$2,$3,\'ACTIVITY_SERIES_CREATED\',$4,$5)',[randomUUID(),tenant,user,series,randomUUID()]);
 await source.query("COMMIT");
 const before=await snapshot(source);if(before.rows.length!==3||before.rows[0].cost!=="150000.0000")throw new Error("Recovery fixture missing");
 const dump=pg("pg_dump","myfarm_phase01_test",["-Fc"]);
 await source.query('CREATE DATABASE "'+restoreName+'"');created=true;
 pg("pg_restore",restoreName,["--exit-on-error"],dump);await restored.connect();connected=true;
 if(JSON.stringify(await snapshot(restored))!==JSON.stringify(before))throw new Error("Restored activity, series, audit or permission state differs");
 const duplicate=await restored.query('INSERT INTO "ProductionActivity" (id,"tenantId","farmId",type,"dueOn","recurrenceId","requestHash","createdBy") VALUES ($1,$2,$3,\'FEEDING\',\'2026-11-03\',$4,\'x\',$5)',[randomUUID(),tenant,farm,series,user]).then(()=>"accepted",e=>e.code);
 if(duplicate!=="23505")throw new Error("Restored one-occurrence-per-date key failed");
 const lifecycle=await restored.query(`UPDATE "ProductionActivity" SET status='COMPLETED' WHERE "tenantId"=$1 AND status='SCHEDULED'`,[tenant]).then(()=>"accepted",e=>e.code);
 if(lifecycle!=="23514")throw new Error("Restored lifecycle check failed");
 console.log("PASS: real dump/restore retains activities, series, cost links and audit receipts, the one-occurrence-per-date key, the lifecycle check, RLS and runtime/browser grants.");
}finally{
 if(connected)await restored.end();if(created)await source.query('DROP DATABASE "'+restoreName+'"');await source.query("ROLLBACK");
 await source.query("BEGIN");for(const table of ["ProductionActivity","ActivityRecurrence","AccountingRecord","AuditEvent","FarmMember","Farm","Farmer"])await source.query('DELETE FROM "'+table+'" WHERE "tenantId"=$1',[tenant]);
 await source.query('DELETE FROM "Membership" WHERE "userId"=$1',[user]);await source.query('DELETE FROM "Organization" WHERE id=$1',[tenant]);await source.query('DELETE FROM "User" WHERE id=$1',[user]);await source.query("COMMIT");await source.end();
}
