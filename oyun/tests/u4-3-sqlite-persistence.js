'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {createRuntime,cloneState}=require('../server/runtime-factory');
const {SqliteAuthorityRepository}=require('../server/sqlite-authority-repository');
const {AuthorityService}=require('../server/authority-service');
function create(db){const runtime=createRuntime(),repository=new SqliteAuthorityRepository({filename:db,cloneState:s=>cloneState(runtime,s)}),service=new AuthorityService({runtime,repository});return{runtime,repository,service};}
function rich(service){const {Economy:E,EconomyNumber:EN,Data:D}=service.A,s=E.createInitialState();s.coins=EN.safe('1e40');for(const k of Object.keys(D.items))s.inventory[k]=EN.safe('1e40');for(const t of D.research)s.researched[t.id]=true;s.market.creditEconomyUnlocked=true;s.market.legacyAccess=true;return s;}
(async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'axyon-u43-')),db=path.join(dir,'authority.sqlite');
  let x=create(db);x.service.seedActor('persist-pilot',rich(x.service),0);const C=x.service.A.DomainCommand;
  const first=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:'persist-pilot',sourceId:'restart-tab',sequence:1,expectedRevision:0,issuedAt:Date.now(),commandId:'restart-command-1'});
  const accepted=await x.service.execute('persist-pilot',first);assert(accepted.ok&&!accepted.duplicate);assert.strictEqual(x.service.snapshot('persist-pilot').serverRevision,1);assert.strictEqual(x.repository.events({actorId:'persist-pilot'}).length,1);x.repository.close();

  // Full repository/service recreation proves state, receipt and outbox durability.
  x=create(db);let snap=x.service.snapshot('persist-pilot');assert.strictEqual(snap.serverRevision,1);assert.strictEqual(snap.state.galaxy.shipQueue.length,1);const replay=await x.service.execute('persist-pilot',first);assert(replay.ok&&replay.duplicate);assert.strictEqual(x.service.snapshot('persist-pilot').state.galaxy.shipQueue.length,1);
  // Publisher crash before acknowledgement leaves event pending; mark survives another restart.
  const pending=x.repository.events({actorId:'persist-pilot'});assert.strictEqual(pending.length,1);const eventId=pending[0].eventId;x.repository.close();
  x=create(db);assert.strictEqual(x.repository.events({actorId:'persist-pilot'}).length,1);assert.strictEqual(x.repository.markEventsPublished([eventId]),1);assert.strictEqual(x.repository.events({actorId:'persist-pilot'}).length,0);x.repository.close();
  x=create(db);assert.strictEqual(x.repository.events({actorId:'persist-pilot'}).length,0);assert.strictEqual(x.repository.events({actorId:'persist-pilot',status:'published'}).length,1);

  // before_commit rolls back every table and remains safely retryable.
  const before=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:'persist-pilot',sourceId:'restart-tab',sequence:2,expectedRevision:1,issuedAt:Date.now(),commandId:'before-commit-u43'});
  const failed=await x.service.execute('persist-pilot',before,{failpoint:'before_commit'});assert(!failed.ok&&failed.code==='transaction_failed');assert.strictEqual(x.service.snapshot('persist-pilot').serverRevision,1);assert.strictEqual(x.repository.ledger('persist-pilot',before.commandId),null);const retried=await x.service.execute('persist-pilot',before);assert(retried.ok&&!retried.duplicate);assert.strictEqual(x.service.snapshot('persist-pilot').serverRevision,2);

  // after_commit mimics lost ACK: process sees failure, restart sees durable receipt and duplicate.
  const after=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:'persist-pilot',sourceId:'restart-tab',sequence:3,expectedRevision:2,issuedAt:Date.now(),commandId:'after-commit-u43'});
  const lostAck=await x.service.execute('persist-pilot',after,{failpoint:'after_commit'});assert(!lostAck.ok&&lostAck.code==='transaction_failed');assert.strictEqual(x.service.snapshot('persist-pilot').serverRevision,3);x.repository.close();
  x=create(db);const safeRetry=await x.service.execute('persist-pilot',after);assert(safeRetry.ok&&safeRetry.duplicate);assert.strictEqual(x.service.snapshot('persist-pilot').serverRevision,3);assert.strictEqual(x.service.snapshot('persist-pilot').state.galaxy.shipQueue.length,3);
  const d=x.repository.diagnostics();assert.strictEqual(d.backend,'sqlite');assert.strictEqual(d.actors,1);assert.strictEqual(d.ledger,3);assert.strictEqual(d.totalEvents,3);x.repository.close();
  fs.rmSync(dir,{recursive:true,force:true});
  console.log('PASS u4-3-sqlite-persistence: WAL restart durability, duplicate replay, rollback, lost ACK recovery and persistent event outbox');
})().catch(error=>{console.error(error);process.exit(1);});
