'use strict';
const assert=require('assert');const fs=require('fs');const path=require('path');
const {loadRuntime,fillEconomy}=require('./runtime-loader');
(function(){
  const ctx=loadRuntime(),{Economy:E,Data:D,DomainCommand:C,ServerReconciliation:R}=ctx.Axyon,state=E.createInitialState();fillEconomy(ctx,state,'1e35');for(const t of D.research)state.researched[t.id]=true;state.market.creditEconomyUnlocked=true;state.market.legacyAccess=true;
  const actor='reconcile-pilot';C._test.ensureRuntime(state).server.lastRevision=3;C._test.ensureRuntime(state).server.needsReconcile=true;C._test.ensureRuntime(state).outbox.push({commandId:'pending-local',fingerprint:'12345678'});state.settings.theme='light';
  const authoritative=E.createInitialState();fillEconomy(ctx,authoritative,'1e20');authoritative.settings.theme='dark';authoritative.market.creditEconomyUnlocked=true;
  const stale=R.apply(state,{schemaVersion:1,actorId:actor,serverRevision:2,serverTime:1000,state:authoritative},{actorId:actor,economy:E,commands:C});assert.strictEqual(stale.code,'stale_server_snapshot');
  const mismatch=R.apply(state,{schemaVersion:1,actorId:'other',serverRevision:4,serverTime:1000,state:authoritative},{actorId:actor,economy:E,commands:C});assert.strictEqual(mismatch.code,'snapshot_actor_mismatch');
  const applied=R.apply(state,{schemaVersion:1,actorId:actor,serverRevision:4,serverTime:2000,state:authoritative},{actorId:actor,economy:E,commands:C});assert(applied.ok);assert.strictEqual(applied.droppedOutbox,1);assert.strictEqual(state.settings.theme,'light','device-local theme must survive authoritative snapshot');const diag=C.diagnostics(state);assert.strictEqual(diag.pending,0);assert.strictEqual(diag.revision,4);assert.strictEqual(diag.server.lastRevision,4);assert.strictEqual(diag.server.needsReconcile,false);

  // Remaining value-bearing UI actions must no longer call Economy directly in main.js.
  const main=fs.readFileSync(path.resolve(__dirname,'../src/main.js'),'utf8');
  for(const name of ['openSector','manualClick','upgradeAutomation','doUpgradeClass','upgradeStorage','toggleAutoSell','setAutoSellKeep','placeMachine','placePlant','moveEntity','removeEntity','addConveyor','addPowerLine','removeLineNear','cancelResearch'])assert(!new RegExp(`E\\.${name}\\s*\\(`).test(main),`main.js still bypasses command layer: ${name}`);
  for(const type of ['sector.open','factory.place','factory.move','factory.remove','factory.add-conveyor','factory.add-power-line','factory.remove-line','machine.manual-run','machine.upgrade-automation','structure.upgrade-class','storage.upgrade','market.toggle-item-auto-sell','market.set-item-keep','research.cancel'])assert(main.includes(type),`UI command missing: ${type}`);

  // Real newly-covered value operation deduplicates after reload-style state serialization.
  const test=E.createInitialState();fillEconomy(ctx,test,'1e35');for(const t of D.research)test.researched[t.id]=true;test.market.creditEconomyUnlocked=true;test.market.legacyAccess=true;
  const item='ironOre',cmd=C.create('storage.upgrade',{itemId:item},{actorId:'coverage-actor',sourceId:'coverage-tab',sequence:1,expectedRevision:0,issuedAt:1000,commandId:'coverage-storage'}),first=C.execute(test,cmd,{actorId:'coverage-actor',economy:E,now:1000});assert(first.ok);const level=test.storageLevel[item],second=C.execute(test,cmd,{actorId:'coverage-actor',economy:E,now:1001});assert(second.duplicate);assert.strictEqual(test.storageLevel[item],level);
  console.log('PASS u4-2-reconciliation-coverage: snapshot CAS, settings preservation, outbox reset and no value-bearing main.js bypass');
})();
