// Actual dump/restore of synthetic officer consent and visit history. Never targets hosted/shared data.
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
const url = process.env.TEST_DATABASE_URL;
if (!url || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost):\d+\/myfarm_phase01_test(?:\?|$)/.test(url)) throw new Error("Officer recovery requires the isolated loopback test database");
const connection = new URL(url), container = process.env.MYFARM_TEST_CONTAINER, bin = process.env.MYFARM_PG_BIN;
if (container && !/^[a-zA-Z0-9_-]+$/.test(container)) throw new Error("Invalid test container");
if (!container && !bin) throw new Error("Set the local PostgreSQL bin directory or disposable test container");
function pg(program, database, args, input) {
  const options = { input, maxBuffer: 64 * 1024 * 1024 };
  if (container) return execFileSync("docker", ["exec", ...(input ? ["-i"] : []), container, program, "-U", decodeURIComponent(connection.username), "-d", database, ...args], options);
  return execFileSync(path.join(bin, program + (process.platform === "win32" ? ".exe" : "")), ["-h", connection.hostname, "-p", connection.port, "-U", decodeURIComponent(connection.username), "-d", database, ...args], { ...options, env: { ...process.env, PGPASSWORD: decodeURIComponent(connection.password) } });
}

const user=randomUUID(),officer=randomUUID(),tenant=randomUUID(),organization=randomUUID(),farmer=randomUUID(),farm=randomUUID(),assignment=randomUUID(),draft=randomUUID(),visit=randomUUID(),photo=randomUUID(),request=randomUUID();
const restoreName="myfarm_p14_restore_"+randomUUID().replaceAll("-","");
if(!/^myfarm_p14_restore_[a-f0-9]{32}$/.test(restoreName))throw Error("Unsafe restore name");
const restoredUrl=new URL(url);restoredUrl.pathname="/"+restoreName;
const source=new Client({connectionString:url}),restored=new Client({connectionString:restoredUrl.toString()});
let created=false,connected=false;
const snapshot=async db=>{
 const rows={};
 for(const table of ["OfficerRegistrationDraft","OfficerAssignment","OfficerVisit","OfficerFollowUp","OfficerProblem","OfficerVisitPhoto","AuditEvent"]){
  rows[table]=(await db.query('SELECT * FROM "'+table+'" WHERE "tenantId"=$1 ORDER BY id',[tenant])).rows;
 }
 rows.grants=(await db.query(`SELECT c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'SELECT') AS browser,has_table_privilege('myfarm_runtime',c.oid,'SELECT') AS runtime FROM pg_class c WHERE c.relname IN ('OfficerRegistrationDraft','OfficerAssignment','OfficerVisit','OfficerFollowUp','OfficerProblem','OfficerVisitPhoto') ORDER BY c.relname`)).rows;
 return rows;
};
await source.connect();
try{
 await source.query("BEGIN");
 for(const id of [user,officer])await source.query('INSERT INTO "User"(id,"authSubject") VALUES($1,$2)',[id,randomUUID()]);
 for(const id of [tenant,organization])await source.query('INSERT INTO "Organization"(id,name,kind) VALUES($1,$2,$3)',[id,'Officer recovery',id===tenant?'PERSONAL':'ORGANIZATION']);
 for(const [actor,org,role] of [[user,tenant,'FARMER'],[officer,organization,'AGENT']])await source.query('INSERT INTO "Membership"("userId","organizationId",role) VALUES($1,$2,$3)',[actor,org,role]);
 await source.query('INSERT INTO "Farmer"(id,"userId","tenantId") VALUES($1,$2,$3)',[farmer,user,tenant]);
 await source.query(`INSERT INTO "Farm"(id,"tenantId","ownerFarmerId",name,district,"ownershipType","primaryActivity","createdBy") VALUES($1,$2,$3,'Officer recovery farm','Rukungiri','OWNED','CROPS',$4)`,[farm,tenant,farmer,user]);
 await source.query(`INSERT INTO "FarmMember"("farmId","tenantId","userId",role) VALUES($1,$2,$3,'OWNER')`,[farm,tenant,user]);
 const digest=createHash('sha256').update('synthetic consent').digest('hex');
 await source.query(`INSERT INTO "OfficerRegistrationDraft"(id,"organizationId","officerId","targetUserId",review,"payloadHash",version,"farmId","tenantId","acceptedAt") VALUES($1,$2,$3,$4,'null'::jsonb,$5,2,$6,$7,now())`,[draft,organization,officer,user,digest,farm,tenant]);
 await source.query(`INSERT INTO "OfficerAssignment"(id,"tenantId","farmId","farmerId","officerId","grantedByOwnerId",permissions,"requestHash","updatedAt") VALUES($1,$2,$3,$4,$5,$6,ARRAY['DASHBOARD','VISITS','FOLLOW_UPS'],$7,now())`,[assignment,tenant,farm,farmer,officer,user,digest]);
 await source.query(`INSERT INTO "OfficerVisit"(id,"tenantId","farmId","officerId","assignmentId","scheduledOn",status,observations,recommendation,"requestHash","updatedAt") VALUES($1,$2,$3,$4,$5,'2026-11-21','COMPLETED','Recorded observation','Recorded recommendation',$6,now())`,[visit,tenant,farm,officer,assignment,digest]);
 await source.query(`INSERT INTO "OfficerFollowUp"(id,"tenantId","farmId","officerId","visitId","dueOn",status,notes,"updatedAt") VALUES($1,$2,$3,$4,$5,'2026-11-23','OPEN','Return visit',now())`,[randomUUID(),tenant,farm,officer,visit]);
 await source.query(`INSERT INTO "OfficerProblem"(id,"tenantId","farmId","officerId","visitId","explicitlyFlagged",description,"updatedAt") VALUES($1,$2,$3,$4,$5,true,'Farmer reported issue',now())`,[randomUUID(),tenant,farm,officer,visit]);
 await source.query(`INSERT INTO "OfficerVisitPhoto"(id,"tenantId","farmId","officerId","visitId","contentType","byteSize",sha256,"uploadedAt") VALUES($1,$2,$3,$4,$5,'image/png',12,$6,now())`,[photo,tenant,farm,officer,visit,digest]);
 await source.query(`INSERT INTO "AuditEvent"(id,"tenantId","actorId",action,"targetId","requestId") VALUES($1,$2,$3,'OFFICER_VISIT_RECORDED',$4,$5)`,[randomUUID(),tenant,officer,visit,request]);
 await source.query("COMMIT");
 const before=await snapshot(source),dump=pg('pg_dump','myfarm_phase01_test',['-Fc']);
 await source.query('CREATE DATABASE "'+restoreName+'"');created=true;
 pg('pg_restore',restoreName,['--exit-on-error'],dump);await restored.connect();connected=true;
 if(JSON.stringify(await snapshot(restored))!==JSON.stringify(before))throw Error('Restored officer rows or grants changed');
 const duplicate=await restored.query(`INSERT INTO "AuditEvent"(id,"tenantId","actorId",action,"targetId","requestId") VALUES($1,$2,$3,'OFFICER_VISIT_RECORDED',$4,$5)`,[randomUUID(),tenant,officer,visit,request]).then(()=>null,e=>e.code);
 if(duplicate!=='23505')throw Error('Receipt uniqueness not restored');
 await restored.query('SET ROLE myfarm_runtime');
 const immutable=await restored.query('UPDATE "OfficerRegistrationDraft" SET version=version+1 WHERE id=$1',[draft]).then(result=>({count:result.rowCount,code:null}),e=>({count:null,code:e.code}));
 await restored.query('RESET ROLE');
 // RLS can hide a completed row from UPDATE before the immutable trigger runs.
 // Both denial paths must preserve the actual restored receipt.
 const receipt=(await restored.query('SELECT version FROM "OfficerRegistrationDraft" WHERE id=$1',[draft])).rows[0];
 if((immutable.count!==0 && immutable.code!=='23514') || receipt?.version!==2)throw Error('Completed receipt is mutable');
 console.log('PASS: actual dump/restore preserves consent receipt, assignment, visit, follow-up, problem, photo metadata, audits, RLS/browser denial, runtime grants and duplicate rejection. Object bytes are outside this database rehearsal.');
}finally{
 if(connected)await restored.end();if(created)await source.query('DROP DATABASE "'+restoreName+'"');
 await source.query('ROLLBACK');await source.query('BEGIN');
 for(const table of ['OfficerRegistrationDraft','OfficerVisitPhoto','OfficerFollowUp','OfficerProblem','OfficerVisit','OfficerAssignment','AuditEvent','FarmMember','Farm','Farmer'])await source.query('DELETE FROM "'+table+'" WHERE "tenantId"=$1',[tenant]);
 await source.query('DELETE FROM "Membership" WHERE "userId"=ANY($1::uuid[])',[[user,officer]]);await source.query('DELETE FROM "Organization" WHERE id=ANY($1::uuid[])',[[tenant,organization]]);await source.query('DELETE FROM "User" WHERE id=ANY($1::uuid[])',[[user,officer]]);
 await source.query('COMMIT');await source.end();
}
