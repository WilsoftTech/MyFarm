// Actual dump/restore of synthetic organization consent, procurement and ledger history. Never targets hosted/shared data.
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Cooperative recovery requires the isolated loopback test database");
const connection = new URL(url), container = process.env.MYFARM_TEST_CONTAINER, bin = process.env.MYFARM_PG_BIN;
if (container && !/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Invalid test container");
if (!container && !bin) throw new Error("Set the local PostgreSQL bin directory or disposable test container");
function pg(program, database, args, input) {
  const options = { input, maxBuffer: 64 * 1024 * 1024 };
  if (container) return execFileSync("docker", ["exec", ...(input ? ["-i"] : []), container, program, "-U", decodeURIComponent(connection.username), "-d", database, ...args], options);
  return execFileSync(path.join(bin, program + (process.platform === "win32" ? ".exe" : "")), ["-h", connection.hostname, "-p", connection.port, "-U", decodeURIComponent(connection.username), "-d", database, ...args], { ...options, env: { ...process.env, PGPASSWORD: decodeURIComponent(connection.password) } });
}

const farmerUser=randomUUID(), manager=randomUUID(), tenant=randomUUID(), org=randomUUID(), farmer=randomUUID(), farm=randomUUID(), share=randomUUID(), lot=randomUUID(), acquisition=randomUUID(), payment=randomUUID(), request=randomUUID();
const restoreName="myfarm_p15_restore_"+randomUUID().replaceAll("-","");
if(!/^myfarm_p15_restore_[a-f0-9]{32}$/.test(restoreName))throw Error("Unsafe restore name");
const restoredUrl=new URL(url); restoredUrl.pathname="/"+restoreName;
const source=new Client({connectionString:url}), restored=new Client({connectionString:restoredUrl.toString()});
let created=false, connected=false;
const tables=['CooperativeMember','CooperativeShare','CooperativeForecast','CooperativeLot','CooperativeEntry','CooperativeReceipt'];
async function snapshot(db){
 const rows={};
 for(const table of tables)rows[table]=(await db.query('SELECT * FROM "'+table+'" WHERE "organizationId"=$1 ORDER BY id',[org])).rows;
 rows.audits=(await db.query('SELECT * FROM "AuditEvent" WHERE "tenantId"=$1 ORDER BY id',[org])).rows;
 rows.grants=(await db.query(`SELECT c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'SELECT') AS browser,has_table_privilege('myfarm_runtime',c.oid,'SELECT') AS runtime FROM pg_class c WHERE c.relname=ANY($1::text[]) ORDER BY c.relname`,[tables])).rows;
 return rows;
}
await source.connect();
try{
 await source.query('BEGIN');
 for(const id of [farmerUser,manager])await source.query('INSERT INTO "User"(id,"authSubject") VALUES($1,$2)',[id,randomUUID()]);
 for(const [id,kind] of [[tenant,'PERSONAL'],[org,'ORGANIZATION']])await source.query('INSERT INTO "Organization"(id,name,kind) VALUES($1,$2,$3)',[id,'Cooperative recovery',kind]);
 await source.query(`INSERT INTO "Membership"("userId","organizationId",role) VALUES($1,$2,'FARMER')`,[farmerUser,tenant]);
 await source.query('INSERT INTO "Farmer"(id,"userId","tenantId") VALUES($1,$2,$3)',[farmer,farmerUser,tenant]);
 await source.query(`INSERT INTO "Farm"(id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES($1,$2,$3,'Recovery farm','Rukungiri','OWNED','CROPS',$4)`,[farm,tenant,farmer,farmerUser]);
 await source.query(`INSERT INTO "FarmMember"("farmId","tenantId","userId",role) VALUES($1,$2,$3,'OWNER')`,[farm,tenant,farmerUser]);
 for(const [user,role]of [[manager,'MANAGER'],[farmerUser,'FARMER']])await source.query(`INSERT INTO "CooperativeMember"(id,"organizationId","userId","invitedBy",role,status) VALUES($1,$2,$3,$4,$5,'ACTIVE')`,[randomUUID(),org,user,manager,role]);
 await source.query(`INSERT INTO "CooperativeShare"(id,"organizationId","farmId","tenantId","grantedBy","shareLocation","shareProduction") VALUES($1,$2,$3,$4,$5,false,true)`,[share,org,farm,tenant,farmerUser]);
 await source.query(`INSERT INTO "CooperativeForecast"(id,"organizationId","shareId","createdBy",product,unit,quantity,"harvestFrom","harvestTo") VALUES($1,$2,$3,$4,'Maize','KG',12,'2026-12-01','2026-12-31')`,[randomUUID(),org,share,farmerUser]);
 await source.query(`INSERT INTO "CooperativeLot"(id,"organizationId","shareId","createdBy",product,unit,quantity,"unitPrice",currency,total,grade,"occurredOn") VALUES($1,$2,$3,$4,'Maize','KG',10,2,'UGX',20,'A','2026-11-24')`,[lot,org,share,manager]);
 await source.query(`INSERT INTO "CooperativeEntry"(id,"organizationId","lotId","operationId","createdBy",kind,location,"quantityDelta","amountDelta","occurredOn",reason) VALUES($1,$2,$3,$3,$4,'STOCK','Store',10,0,'2026-11-24','PROCUREMENT')`,[acquisition,org,lot,manager]);
 await source.query(`INSERT INTO "CooperativeEntry"(id,"organizationId","lotId","operationId","createdBy",kind,location,"quantityDelta","amountDelta","occurredOn",reason) VALUES($1,$2,$3,$1,$4,'PAYMENT','',0,5,'2026-11-24','Receipt')`,[payment,org,lot,manager]);
 const digest=createHash('sha256').update('synthetic procurement').digest('hex');
 await source.query(`INSERT INTO "CooperativeReceipt"(id,"organizationId","actorId","requestId",action,"requestHash","targetId","targetVersion") VALUES($1,$2,$3,$4,'PROCURE',$5,$6,1)`,[randomUUID(),org,manager,request,digest,lot]);
 await source.query(`INSERT INTO "AuditEvent"(id,"tenantId","actorId",action,"targetId","requestId") VALUES($1,$2,$3,'COOP_PROCURE',$4,$5)`,[randomUUID(),org,manager,lot,request]);
 await source.query('COMMIT');
 const before=await snapshot(source),dump=pg('pg_dump','myfarm_phase01_test',['-Fc']);
 await source.query('CREATE DATABASE "'+restoreName+'"');created=true;
 pg('pg_restore',restoreName,['--exit-on-error'],dump);await restored.connect();connected=true;
 if(JSON.stringify(await snapshot(restored))!==JSON.stringify(before))throw Error('Restored organization records, audit history or privileges changed');
 const sums=(await restored.query('SELECT sum("quantityDelta")::text AS stock,sum("amountDelta")::text AS paid FROM "CooperativeEntry" WHERE "lotId"=$1',[lot])).rows[0];
 if(sums.stock!=='10.000000'||sums.paid!=='5.0000')throw Error('Restored stock/payment reconstruction failed');
 const duplicate=await restored.query(`INSERT INTO "CooperativeReceipt"(id,"organizationId","actorId","requestId",action,"requestHash","targetId","targetVersion") VALUES($1,$2,$3,$4,'PROCURE',$5,$6,1)`,[randomUUID(),org,manager,request,digest,lot]).then(()=>null,e=>e.code);
 if(duplicate!=='23505')throw Error('Restored duplicate command was accepted');
 await restored.query('SET ROLE myfarm_runtime');
 for(const table of ['CooperativeEntry','CooperativeReceipt']){
  const denied=await restored.query('DELETE FROM "'+table+'" WHERE false').then(()=>null,e=>e.code);
  if(denied!=='42501')throw Error('Restored ledger/receipt mutation permissions changed');
 }
 await restored.query('RESET ROLE');await restored.query('SET ROLE authenticated');
 const denied=await restored.query('SELECT * FROM "CooperativeLot"').then(()=>null,e=>e.code);
 if(denied!=='42501')throw Error('Restored browser role could read organization records');
 await restored.query('RESET ROLE');
 console.log('PASS: actual dump/restore preserves membership/consent, estimates, procurement origin, exact stock/payment reconstruction, immutable ledger/receipt permissions, audit history, duplicate rejection and browser denial.');
}finally{
 if(connected)await restored.end();if(created)await source.query('DROP DATABASE "'+restoreName+'"');
 await source.query('ROLLBACK');await source.query('BEGIN');
 for(const table of ['CooperativeReceipt','CooperativeEntry','CooperativeForecast','CooperativeLot','CooperativeShare','CooperativeMember'])await source.query('DELETE FROM "'+table+'" WHERE "organizationId"=$1',[org]);
 await source.query('DELETE FROM "AuditEvent" WHERE "tenantId"=$1',[org]);
 for(const table of ['FarmMember','Farm','Farmer'])await source.query('DELETE FROM "'+table+'" WHERE "tenantId"=$1',[tenant]);
 await source.query('DELETE FROM "Membership" WHERE "userId"=$1',[farmerUser]);
 await source.query('DELETE FROM "Organization" WHERE id=ANY($1::uuid[])',[[tenant,org]]);await source.query('DELETE FROM "User" WHERE id=ANY($1::uuid[])',[[farmerUser,manager]]);
 await source.query('COMMIT');await source.end();
}
