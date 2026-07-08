'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {loadRuntime,memoryStorage,fillEconomy}=require('./runtime-loader');
const {createRuntime,cloneState}=require('../server/runtime-factory');
const {SqliteAuthorityRepository}=require('../server/sqlite-authority-repository');
const {AuthorityService}=require('../server/authority-service');
const {createHttpServer}=require('../server/http-server');
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axyon-u43-net-')),db=path.join(dir,'authority.sqlite'),serverRuntime=createRuntime(),repository=new SqliteAuthorityRepository({filename:db,cloneState:s=>cloneState(serverRuntime,s)}),service=new AuthorityService({runtime:serverRuntime,repository}),app=createHttpServer({service,rateLimit:{limit:1000,windowMs:60000}}),addr=await app.listen(0),base=`http://127.0.0.1:${addr.port}`;
  try{
    const ctx=loadRuntime({localStorage:memoryStorage(),fetch:global.fetch}),{Economy:E,EconomyNumber:EN,Data:D,DomainCommand:C,ServerNetwork:N,ServerReconciliation:R}=ctx.Axyon,actor='network-pilot',state=E.createInitialState();
    fillEconomy(ctx,state,'1e40');for(const t of D.research)state.researched[t.id]=true;state.market.creditEconomyUnlocked=true;state.market.legacyAccess=true;state.settings.theme='light';service.seedActor(actor,JSON.parse(JSON.stringify(state)),0);N.configure(base,{persist:false});let saves=0,changes=0;
    const opts={actorId:actor,economy:E,commands:C,reconciliation:R,save:()=>saves++,onChange:()=>changes++};

    const one=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:actor,sourceId:'net-tab',sequence:1,expectedRevision:0,issuedAt:Date.now(),commandId:'net-command-1'});
    assert(C.execute(state,one,{actorId:actor,economy:E,now:Date.now(),queueForServer:true}).ok);assert.strictEqual(C.diagnostics(state).pending,1);
    let sync=await N.syncNow(state,opts);assert.strictEqual(sync.status,'online');assert.strictEqual(sync.acked,1);assert.strictEqual(C.diagnostics(state).pending,0);assert.strictEqual(C.diagnostics(state).server.lastRevision,1);assert.strictEqual(service.snapshot(actor).serverRevision,1);

    // Offline delivery leaves the optimistic command durably queued.
    const two=C.create('market.set-global-keep',{pct:25},{actorId:actor,sourceId:'net-tab',sequence:2,expectedRevision:1,issuedAt:Date.now(),commandId:'net-command-2'});assert(C.execute(state,two,{actorId:actor,economy:E,now:Date.now(),queueForServer:true}).ok);
    const realFetch=ctx.fetch;ctx.fetch=async()=>{throw new Error('simulated_offline')};sync=await N.syncNow(state,opts);assert.strictEqual(sync.status,'offline');assert.strictEqual(C.diagnostics(state).pending,1);ctx.fetch=realFetch;
    sync=await N.syncNow(state,opts);assert.strictEqual(sync.status,'online');assert.strictEqual(C.diagnostics(state).pending,0);assert.strictEqual(service.snapshot(actor).serverRevision,2);

    // A different client advances authority. Local stale optimistic mutation is rejected and replaced by snapshot.
    const local=C.create('market.set-global-keep',{pct:75},{actorId:actor,sourceId:'net-tab',sequence:3,expectedRevision:2,issuedAt:Date.now(),commandId:'net-stale-local'});assert(C.execute(state,local,{actorId:actor,economy:E,now:Date.now(),queueForServer:true}).ok);assert.strictEqual(state.market.keepPct,75);
    const external=serverRuntime.DomainCommand.create('market.set-global-keep',{pct:0},{actorId:actor,sourceId:'other-device',sequence:1,expectedRevision:2,issuedAt:Date.now(),commandId:'external-authority'});const ext=await service.execute(actor,external);assert(ext.ok);assert.strictEqual(service.snapshot(actor).serverRevision,3);
    sync=await N.syncNow(state,opts);assert.strictEqual(sync.status,'online');assert(sync.reconciled);assert.strictEqual(C.diagnostics(state).pending,0);assert.strictEqual(C.revision(state),3);assert.strictEqual(state.market.keepPct,0);assert.strictEqual(state.settings.theme,'light','local device settings were not preserved');assert.strictEqual(C.diagnostics(state).server.needsReconcile,false);
    assert(saves>=3&&changes>=3);
    console.log('PASS u4-3-network-adapter: real HTTP outbox ACK, offline retry, stale rejection and authoritative snapshot reconciliation');
  }finally{await app.close();repository.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
