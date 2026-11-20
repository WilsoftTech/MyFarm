import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const dir='.cache/p13-final';fs.mkdirSync(dir,{recursive:true});
const url='postgresql://myfarm:isolated-ci-password@127.0.0.1:55482/myfarm_phase01_test';
const env={...process.env,DATABASE_URL:url,DIRECT_URL:url,TEST_DATABASE_URL:url,MYFARM_TEST_CONTAINER:'myfarm-p13-audit-20261120',NEXT_TELEMETRY_DISABLED:'1'};
const commands=[['lint','npm run lint'],['typecheck','npm run typecheck'],['boundaries','npm run check:boundaries'],['unit','npm test'],['migrate','npm run db:migrate'],['integration','npm run test:integration'],['non-utc','npm run test:integration -- tests/integration/weather-service.test.ts tests/integration/activity-service.test.ts tests/integration/activity-lifecycle.test.ts',{TZ:'Africa/Nairobi'}],['drift','node node_modules/prisma/build/index.js migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code'],['stock-recovery','node tests/support/phase05-recovery.mjs'],['activity-recovery','node tests/support/phase06-recovery.mjs'],['voice-recovery','node tests/support/phase12-recovery.mjs'],['audit','npm audit --omit=dev --json'],['anonymous-browser','npm run test:e2e -- --reporter=line'],['fixture-build','npm run build',{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3211',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-publishable-key'}],['weather-browser','npm run test:e2e -- --config playwright.production.config.ts tests/browser/weather-ui.spec.ts --reporter=line'],['signed-in-browser','npm run test:e2e -- --config playwright.production.config.ts --reporter=line']];
commands.push(['final-lint','npm run lint'],['final-typecheck','npm run typecheck'],['final-unit','npm test'],['final-build','npm run build']);
const from=process.argv[2]?commands.findIndex(([name])=>name===process.argv[2]):0;if(from<0)throw Error('Unknown check');
const records=from&&fs.existsSync(dir+'/checks.json')?JSON.parse(fs.readFileSync(dir+'/checks.json')).filter(x=>!commands.slice(from).some(([name])=>name===x.name)):[];
for(const [name,command,extra={}] of commands.slice(from)){
 const fd=fs.openSync(dir+'/'+name+'.log','w');console.log('CHECK',name);
 const result=spawnSync(process.env.ComSpec,['/d','/s','/c',command],{env:{...env,...extra},stdio:['ignore',fd,fd],timeout:1800_000});fs.closeSync(fd);
 const record={name,command,exitCode:result.status,error:result.error?.message??null};records.push(record);fs.writeFileSync(dir+'/checks.json',JSON.stringify(records,null,2));console.log(JSON.stringify(record));
 if(result.status!==0){console.log(fs.readFileSync(dir+'/'+name+'.log','utf8').slice(-6500));process.exit(1);}
}
