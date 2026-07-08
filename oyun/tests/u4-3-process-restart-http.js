'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),{fork}=require('child_process');
const {createRuntime}=require('../server/runtime-factory');
function rich(){const A=createRuntime(),{Economy:E,EconomyNumber:EN,Data:D}=A,s=E.createInitialState();s.coins=EN.safe('1e40');for(const k of Object.keys(D.items))s.inventory[k]=EN.safe('1e40');for(const t of D.research)s.researched[t.id]=true;s.market.creditEconomyUnlocked=true;s.market.legacyAccess=true;return{A,state:s};}
function start(db){return new Promise((resolve,reject)=>{const child=fork(path.join(__dirname,'helpers/u4-3-server-child.js'),[],{env:{...process.env,AXYON_AUTH_DB:db},stdio:['ignore','inherit','inherit','ipc']});const timer=setTimeout(()=>reject(new Error('child_start_timeout')),10000);child.once('error',reject);child.on('message',m=>{if(m?.type==='ready'){clearTimeout(timer);resolve({child,base:`http://127.0.0.1:${m.port}`});}});});}
function stop(child){return new Promise(resolve=>{child.once('exit',()=>resolve());child.send('stop');setTimeout(()=>{if(!child.killed)child.kill('SIGKILL');},3000);});}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axyon-u43-http-')),db=path.join(dir,'authority.sqlite'),actor='restart-http';let app=await start(db);const {A,state}=rich(),C=A.DomainCommand,headers={'content-type':'application/json','x-axyon-actor':actor};
  let r=await fetch(`${app.base}/v1/actors/${actor}/seed`,{method:'POST',headers,body:JSON.stringify({state,revision:0})});assert.strictEqual(r.status,201);
  const command=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:actor,sourceId:'restart-http-tab',sequence:1,expectedRevision:0,issuedAt:Date.now(),commandId:'restart-http-command'});
  r=await fetch(`${app.base}/v1/actors/${actor}/commands`,{method:'POST',headers,body:JSON.stringify({command})});assert.strictEqual(r.status,200);assert(!(await r.json()).duplicate);await stop(app.child);

  app=await start(db);r=await fetch(`${app.base}/v1/actors/${actor}/snapshot`,{headers:{'x-axyon-actor':actor}});const snapshot=(await r.json()).snapshot;assert.strictEqual(snapshot.serverRevision,1);assert.strictEqual(snapshot.state.galaxy.shipQueue.length,1);
  r=await fetch(`${app.base}/v1/actors/${actor}/commands`,{method:'POST',headers,body:JSON.stringify({command})});const duplicate=await r.json();assert.strictEqual(r.status,200);assert(duplicate.duplicate);assert.strictEqual(duplicate.receipt.serverRevision,1);
  const health=await fetch(`${app.base}/health`);const healthBody=await health.json();assert.strictEqual(healthBody.version,'4.5.5-u4.3.2');assert.strictEqual(healthBody.diagnostics.backend,'sqlite');
  await stop(app.child);fs.rmSync(dir,{recursive:true,force:true});
  console.log('PASS u4-3-process-restart-http: real server process restart preserves state, receipt, duplicate guarantee and SQLite diagnostics');
})().catch(error=>{console.error(error);process.exit(1);});
