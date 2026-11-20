import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const directory='.cache/p13-ui-final';fs.mkdirSync(directory,{recursive:true});
const url='postgresql://myfarm:isolated-ci-password@127.0.0.1:55482/myfarm_phase01_test';
const base={...process.env,DATABASE_URL:url,DIRECT_URL:url,TEST_DATABASE_URL:url,NEXT_TELEMETRY_DISABLED:'1'};
const commands=[['post-ui-fixture-build','npm run build',{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:3211',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'fixture-publishable-key'}],['post-ui-weather-browser','npm run test:e2e -- --config playwright.production.config.ts tests/browser/weather-ui.spec.ts --reporter=line',{}],['post-ui-default-build','npm run build',{}]];
const records=[];
for(const [name,command,extra] of commands){
 const fd=fs.openSync(directory+'/'+name+'.log','w');console.log('CHECK',name);
 const result=spawnSync(process.env.ComSpec,['/d','/s','/c',command],{env:{...base,...extra},stdio:['ignore',fd,fd],timeout:1800_000});fs.closeSync(fd);
 records.push({name,command,exitCode:result.status});fs.writeFileSync(directory+'/checks.json',JSON.stringify(records,null,2));console.log(name,result.status);
 if(result.status!==0){console.log(fs.readFileSync(directory+'/'+name+'.log','utf8').slice(-5000));process.exit(1);}
}
