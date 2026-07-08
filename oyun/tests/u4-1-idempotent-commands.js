'use strict';
const assert=require('assert');
const {loadRuntime,memoryStorage,fillEconomy}=require('./runtime-loader');

(function(){
  const storage=memoryStorage();
  const ctx=loadRuntime({localStorage:storage,saveService:true});
  const {Economy:E,Data:D,DomainCommand:C,SaveService:S}=ctx.Axyon;
  const state=E.createInitialState();
  fillEconomy(ctx,state,'1e30');
  for(const tech of D.research)state.researched[tech.id]=true;
  const created=S.createProfile('Command Pilot',state);
  assert(created.ok);
  const actorId=S.currentProfileId();
  let live=created.state;

  // A real value-bearing shipyard command is applied only once.
  const shipCommand=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId,sourceId:'tab-alpha',sequence:1,expectedRevision:0,issuedAt:1000});
  const first=C.execute(live,shipCommand,{actorId,economy:E,now:1000,queueForServer:true});
  assert(first.ok&&first.applied&&first.recorded);
  assert.strictEqual(live.galaxy.shipQueue.length,1);
  assert.strictEqual(C.revision(live),1);

  const duplicate=C.execute(live,shipCommand,{actorId,economy:E,now:1001,queueForServer:true});
  assert(duplicate.duplicate&&!duplicate.applied&&duplicate.ok);
  assert.strictEqual(duplicate.receipt.commandId,shipCommand.commandId);
  assert.strictEqual(live.galaxy.shipQueue.length,1,'duplicate command queued a second ship');
  assert.strictEqual(C.revision(live),1,'duplicate command advanced domain revision');

  // Receipt survives a real v16 save/load round trip.
  assert(S.save(live));
  live=S.load();
  const afterReload=C.execute(live,shipCommand,{actorId,economy:E,now:1002,queueForServer:true});
  assert(afterReload.duplicate&&afterReload.ok);
  assert.strictEqual(live.galaxy.shipQueue.length,1,'reload replay applied a second ship');

  // Offline outbox keeps one envelope, validates the server fingerprint and accepts ACK exactly once.
  const pending=C.outboxBatch(live,10);assert.strictEqual(pending.length,1);assert.strictEqual(pending[0].commandId,shipCommand.commandId);
  const badAck=C.acknowledge(live,{commandId:shipCommand.commandId,fingerprint:'wrong',status:'accepted',serverRevision:1,serverTime:1200},{actorId});
  assert(!badAck.ok&&badAck.code==='ack_fingerprint_mismatch');assert.strictEqual(C.diagnostics(live).pending,1);
  const ack=C.acknowledge(live,{commandId:shipCommand.commandId,fingerprint:pending[0].fingerprint,status:'accepted',serverRevision:1,serverTime:1200,receivedAt:1210},{actorId});
  assert(ack.ok&&!ack.duplicate);assert.strictEqual(C.diagnostics(live).pending,0);
  const ackReplay=C.acknowledge(live,{commandId:shipCommand.commandId,fingerprint:pending[0].fingerprint,status:'accepted',serverRevision:1,serverTime:1200,receivedAt:1211},{actorId});
  assert(ackReplay.ok&&ackReplay.duplicate);

  // Same source/sequence/id with different payload is a hard conflict.
  const collision=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:2},{actorId,sourceId:'tab-alpha',sequence:1,expectedRevision:0,issuedAt:1000});
  const conflict=C.execute(live,collision,{actorId,economy:E,now:1003});
  assert(conflict.conflict&&conflict.code==='command_id_conflict');
  assert.strictEqual(live.galaxy.shipQueue.length,1);

  // A stale new command is deterministically rejected and its replay stays rejected.
  const stale=C.create('market.set-global-keep',{pct:25},{actorId,sourceId:'tab-alpha',sequence:2,expectedRevision:0,issuedAt:1010});
  const staleFirst=C.execute(live,stale,{actorId,economy:E,now:1010});
  assert(!staleFirst.ok&&staleFirst.recorded&&staleFirst.receipt.code==='stale_revision');
  assert.strictEqual(C.revision(live),1);
  const staleReplay=C.execute(live,stale,{actorId,economy:E,now:1011});
  assert(staleReplay.duplicate&&!staleReplay.ok&&staleReplay.receipt.code==='stale_revision');

  // A fresh command with the current revision applies.
  const fresh=C.create('market.set-global-keep',{pct:25},{actorId,sourceId:'tab-alpha',sequence:3,expectedRevision:1,issuedAt:1020});
  const freshResult=C.execute(live,fresh,{actorId,economy:E,now:1020});
  assert(freshResult.ok&&freshResult.applied);
  assert.strictEqual(live.market.keepPct,25);
  assert.strictEqual(C.revision(live),2);

  // Two concurrent retries in one authority state resolve to one apply + one receipt replay.
  const concurrent=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId,sourceId:'tab-beta',sequence:1,expectedRevision:2,issuedAt:1030});
  const results=[
    C.execute(live,concurrent,{actorId,economy:E,now:1030}),
    C.execute(live,concurrent,{actorId,economy:E,now:1030})
  ];
  assert.strictEqual(results.filter(x=>x.applied).length,1);
  assert.strictEqual(results.filter(x=>x.duplicate).length,1);
  assert.strictEqual(live.galaxy.shipQueue.length,2,'concurrent duplicate applied more than once');
  assert.strictEqual(C.revision(live),3);

  // Actor mismatch cannot poison the command high-water mark.
  const unauthorized=C.create('market.set-global-keep',{pct:40},{actorId,sourceId:'tab-gamma',sequence:1,expectedRevision:3,issuedAt:1040});
  const actorMismatch=C.execute(live,unauthorized,{actorId:'another-profile',economy:E,now:1040});
  assert(!actorMismatch.ok&&!actorMismatch.recorded&&actorMismatch.code==='actor_mismatch');
  const authorized=C.execute(live,unauthorized,{actorId,economy:E,now:1041});
  assert(authorized.ok&&authorized.applied,'unauthorized attempt poisoned the legitimate command');

  // Bounded receipts do not permit old commands to execute again: high-water remains authoritative.
  let revision=C.revision(live);
  for(let seq=1;seq<=C.MAX_RECEIPTS_PER_SOURCE+8;seq++){
    const cmd=C.create('market.set-global-keep',{pct:seq%101},{actorId,sourceId:'tab-prune',sequence:seq,expectedRevision:revision,issuedAt:2000+seq});
    const result=C.execute(live,cmd,{actorId,economy:E,now:2000+seq});
    assert(result.ok);revision++;
  }
  const old=C.create('market.set-global-keep',{pct:1},{actorId,sourceId:'tab-prune',sequence:1,expectedRevision:3,issuedAt:2001});
  const oldReplay=C.execute(live,old,{actorId,economy:E,now:5000});
  assert(!oldReplay.ok&&oldReplay.duplicate&&oldReplay.code==='replay_below_high_water');
  assert.strictEqual(C.diagnostics(live).sources>=4,true);

  // Outbox backpressure rejects the next server-owned action instead of applying an untracked mutation.
  C.register('test.server-owned',({state})=>{state.__commandCounter=(state.__commandCounter||0)+1;return{ok:true,data:{counter:state.__commandCounter}};});
  const fullState=E.createInitialState();let fullRevision=0;
  for(let seq=1;seq<=C.MAX_OUTBOX;seq++){
    const cmd=C.create('test.server-owned',{}, {actorId:'capacity-actor',sourceId:'capacity-source',sequence:seq,expectedRevision:fullRevision,issuedAt:6000+seq});
    const applied=C.execute(fullState,cmd,{actorId:'capacity-actor',economy:E,now:6000+seq,queueForServer:true});assert(applied.ok);fullRevision++;
  }
  assert.strictEqual(C.diagnostics(fullState).pending,C.MAX_OUTBOX);
  const overflow=C.create('test.server-owned',{}, {actorId:'capacity-actor',sourceId:'capacity-source',sequence:C.MAX_OUTBOX+1,expectedRevision:fullRevision,issuedAt:7000});
  const overflowResult=C.execute(fullState,overflow,{actorId:'capacity-actor',economy:E,now:7000,queueForServer:true});
  assert(!overflowResult.ok&&overflowResult.receipt.code==='outbox_full');assert.strictEqual(fullState.__commandCounter,C.MAX_OUTBOX);

  console.log('PASS u4-1-idempotent-commands: real economy dedup, persisted receipts, ACK/outbox contract, conflicts, stale revision, concurrent retry and bounded replay/backpressure');
})();
