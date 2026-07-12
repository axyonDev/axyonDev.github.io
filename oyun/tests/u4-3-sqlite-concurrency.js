'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),{Worker}=require('worker_threads');
const {createRuntime,cloneState}=require('../server/runtime-factory');
const {SqliteAuthorityRepository}=require('../server/sqlite-authority-repository');
const {AuthorityService}=require('../server/authority-service');
const {createHttpServer}=require('../server/http-server');
function rich(A){const {Economy:E,EconomyNumber:EN,Data:D}=A,s=E.createInitialState();s.coins=EN.safe('1e50');for(const k of Object.keys(D.items))s.inventory[k]=EN.safe('1e50');for(const t of D.research)s.researched[t.id]=true;s.market.creditEconomyUnlocked=true;s.market.legacyAccess=true;return s;}
function worker(file,data){return new Promise((resolve,reject)=>{const w=new Worker(file,{workerData:data});let message;w.once('message',m=>{message=m;});w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error(`worker_exit_${code}`));else resolve(message);});});}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axyon-u43-race-')),db=path.join(dir,'authority.sqlite'),runtime=createRuntime(),repository=new SqliteAuthorityRepository({filename:db,cloneState:s=>cloneState(runtime,s),busyTimeoutMs:10000}),service=new AuthorityService({runtime,repository}),actor='sqlite-race-pilot';service.seedActor(actor,rich(runtime),0);
  const app=createHttpServer({service,rateLimit:{limit:1000,windowMs:60000}}),addr=await app.listen(0),base=`http://127.0.0.1:${addr.port}`,C=runtime.DomainCommand;
  try{
    const same=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:actor,sourceId:'load-tab',sequence:1,expectedRevision:0,issuedAt:Date.now(),commandId:'load-same-command'}),headers={'content-type':'application/json','x-axyon-actor':actor};
    const results=await Promise.all(Array.from({length:128},()=>fetch(`${base}/v1/actors/${actor}/commands`,{method:'POST',headers,body:JSON.stringify({command:same})}).then(r=>r.json())));
    assert.strictEqual(results.filter(x=>x.ok&&!x.duplicate).length,1);assert.strictEqual(results.filter(x=>x.duplicate).length,127);assert.strictEqual(service.snapshot(actor).serverRevision,1);assert.strictEqual(service.snapshot(actor).state.galaxy.shipQueue.length,1);assert.strictEqual(repository.events({actorId:actor}).length,1);
  }finally{await app.close();repository.close();}

  // Two independent Node workers/SQLite connections race at the same server revision.
  let seedRepo=new SqliteAuthorityRepository({filename:db,cloneState:s=>cloneState(runtime,s),busyTimeoutMs:10000}),snap=seedRepo.snapshot(actor);assert.strictEqual(snap.revision,1);seedRepo.close();
  const a=C.create('market.set-global-keep',{pct:0},{actorId:actor,sourceId:'worker-A',sequence:1,expectedRevision:1,issuedAt:Date.now(),commandId:'worker-command-A'}),b=C.create('market.set-global-keep',{pct:100},{actorId:actor,sourceId:'worker-B',sequence:1,expectedRevision:1,issuedAt:Date.now(),commandId:'worker-command-B'}),helper=path.join(__dirname,'helpers/u4-3-command-worker.js');
  const pair=await Promise.all([worker(helper,{db,actor,command:a}),worker(helper,{db,actor,command:b})]);assert(pair.every(x=>x.ok));const responses=pair.map(x=>x.result);assert.strictEqual(responses.filter(x=>x.ok).length,1);assert.strictEqual(responses.filter(x=>x.code==='stale_revision').length,1);
  const finalRepo=new SqliteAuthorityRepository({filename:db,cloneState:s=>cloneState(runtime,s)}),final=finalRepo.snapshot(actor);assert.strictEqual(final.revision,2);const ledgerCount=finalRepo.diagnostics().ledger;assert([2,3].includes(ledgerCount),'unexpected ledger count after CAS race');const receipts=[finalRepo.ledger(actor,'worker-command-A'),finalRepo.ledger(actor,'worker-command-B')].filter(Boolean);assert.strictEqual(receipts.filter(r=>r.status==='accepted').length,1,'stale cross-process command was falsely accepted');assert(receipts.length===1||receipts.some(r=>r.status==='rejected'&&r.code==='stale_revision'),'stale command was neither omitted nor recorded as rejected');assert.strictEqual(finalRepo.diagnostics().totalEvents,2);finalRepo.close();fs.rmSync(dir,{recursive:true,force:true});
  console.log('PASS u4-3-sqlite-concurrency: 128 duplicate HTTP requests plus two-process SQLite CAS race produce one commit without lost update');
})().catch(error=>{console.error(error);process.exit(1);});
