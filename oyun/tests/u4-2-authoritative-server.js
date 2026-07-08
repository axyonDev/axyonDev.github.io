'use strict';
const assert=require('assert');
const {AuthorityService}=require('../server/authority-service');
const {MemoryAuthorityRepository}=require('../server/authoritative-repository');

function richState(service){
  const {Economy:E,EconomyNumber:EN,Data:D}=service.A,state=E.createInitialState();
  state.coins=EN.safe('1e40');for(const k of Object.keys(D.items))state.inventory[k]=EN.safe('1e40');for(const t of D.research)state.researched[t.id]=true;
  state.market.creditEconomyUnlocked=true;state.market.legacyAccess=true;return state;
}
function command(service,actor,source,sequence,revision,payload={shipId:'spyProbe',count:1},id=`${actor}-${source}-${sequence}`,type='shipyard.queue-ship'){
  return service.A.DomainCommand.create(type,payload,{actorId:actor,sourceId:source,sequence,expectedRevision:revision,issuedAt:Date.now(),commandId:id});
}
(async()=>{
  const service=new AuthorityService();service.seedActor('pilot-alpha',richState(service),0);
  const cmd=command(service,'pilot-alpha','tab-alpha',1,0,undefined,'cmd-concurrent-1');
  const pair=await Promise.all([service.execute('pilot-alpha',cmd),service.execute('pilot-alpha',cmd)]);
  assert.strictEqual(pair.filter(x=>x.ok&&!x.duplicate).length,1,'exactly one request must apply');
  assert.strictEqual(pair.filter(x=>x.duplicate).length,1,'second request must replay receipt');
  let snap=service.snapshot('pilot-alpha');assert.strictEqual(snap.serverRevision,1);assert.strictEqual(snap.state.galaxy.shipQueue.length,1);
  assert.strictEqual(service.diagnostics().ledger,1);assert.strictEqual(service.diagnostics().pendingEvents,1);

  // Immutable command identity.
  const conflict=command(service,'pilot-alpha','tab-alpha',1,0,{shipId:'spyProbe',count:2},'cmd-concurrent-1');
  const conflictResult=await service.execute('pilot-alpha',conflict);assert.strictEqual(conflictResult.code,'command_id_conflict');assert.strictEqual(service.snapshot('pilot-alpha').state.galaxy.shipQueue.length,1);

  // Same source sequence cannot be claimed by a renamed command.
  const sequenceCollision=command(service,'pilot-alpha','tab-alpha',1,1,{shipId:'spyProbe',count:1},'renamed-command');
  const seqResult=await service.execute('pilot-alpha',sequenceCollision);assert.strictEqual(seqResult.code,'source_sequence_conflict');

  // Different commands racing on the same CAS revision: one applies, one becomes stale.
  const a=command(service,'pilot-alpha','tab-beta',1,1,{shipId:'spyProbe',count:1},'cas-a');
  const b=command(service,'pilot-alpha','tab-gamma',1,1,{shipId:'spyProbe',count:1},'cas-b');
  const race=await Promise.all([service.execute('pilot-alpha',a),service.execute('pilot-alpha',b)]);
  assert.strictEqual(race.filter(x=>x.ok).length,1);assert.strictEqual(race.filter(x=>x.code==='stale_revision').length,1);
  snap=service.snapshot('pilot-alpha');assert.strictEqual(snap.serverRevision,2);assert.strictEqual(snap.state.galaxy.shipQueue.length,2);
  assert.strictEqual(service.diagnostics().pendingEvents,2,'rejected CAS command must not emit event');

  // Real rollback: forced pre-commit failure leaves state, ledger and event outbox untouched.
  const before=service.diagnostics(),beforeSnap=service.snapshot('pilot-alpha');
  const rollbackCmd=command(service,'pilot-alpha','tab-delta',1,2,{shipId:'spyProbe',count:1},'rollback-command');
  const failed=await service.execute('pilot-alpha',rollbackCmd,{failpoint:'before_commit'});assert.strictEqual(failed.code,'transaction_failed');
  assert.deepStrictEqual(service.diagnostics(),before);assert.strictEqual(service.snapshot('pilot-alpha').serverRevision,beforeSnap.serverRevision);assert.strictEqual(service.repository.ledger('pilot-alpha','rollback-command'),null);
  const retried=await service.execute('pilot-alpha',rollbackCmd);assert(retried.ok&&!retried.duplicate);assert.strictEqual(service.snapshot('pilot-alpha').serverRevision,3);

  // Actor isolation: same command id is independently valid for another actor.
  service.seedActor('pilot-bravo',richState(service),0);
  const bravo=command(service,'pilot-bravo','tab-bravo',1,0,{shipId:'spyProbe',count:1},'cmd-concurrent-1');
  const bravoResult=await service.execute('pilot-bravo',bravo);assert(bravoResult.ok);assert.strictEqual(service.snapshot('pilot-bravo').serverRevision,1);

  // Event outbox can be published idempotently.
  const pending=service.repository.events({status:'pending'});assert.strictEqual(pending.length,4);assert.strictEqual(service.repository.markEventsPublished(pending.map(x=>x.eventId)),4);assert.strictEqual(service.repository.markEventsPublished(pending.map(x=>x.eventId)),0);

  // Keyed mutex keeps same actor serial but permits different actors in parallel.
  const repo=new MemoryAuthorityRepository({cloneState:x=>JSON.parse(JSON.stringify(x))});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));const started=Date.now();
  await Promise.all([repo.withActor('a',async()=>sleep(70)),repo.withActor('b',async()=>sleep(70))]);
  assert(Date.now()-started<125,'different actors were unnecessarily serialized');
  let order=[];await Promise.all([repo.withActor('same',async()=>{order.push('a1');await sleep(35);order.push('a2');}),repo.withActor('same',async()=>{order.push('b1');})]);assert.deepStrictEqual(order,['a1','a2','b1']);

  console.log('PASS u4-2-authoritative-server: concurrent duplicate, unique ledger, source sequence, CAS race, rollback, actor isolation, event outbox and keyed mutex');
})().catch(error=>{console.error(error);process.exit(1);});
