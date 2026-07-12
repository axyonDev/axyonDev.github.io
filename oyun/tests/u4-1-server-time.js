'use strict';
const assert=require('assert');
const {loadRuntime,memoryStorage}=require('./runtime-loader');

(function(){
  const storage=memoryStorage(),ctx=loadRuntime({localStorage:storage,saveService:true});
  const {ServerClock:Clock,Economy:E,SaveService:S}=ctx.Axyon;
  let state=E.createInitialState();

  const observed=Clock.observe(state,{serverTime:100000,sentAt:90000,receivedAt:92000,serverRevision:5});
  assert(observed.ok);assert.strictEqual(observed.offsetMs,9000);assert.strictEqual(observed.uncertaintyMs,1000);
  assert.strictEqual(Clock.serverNow(state,93000),102000);
  assert.strictEqual(Clock.serverNow(state,80000),102000,'server clock moved backwards');
  const stale=Clock.observe(state,{serverTime:101000,sentAt:93000,receivedAt:94000,serverRevision:4});
  assert(!stale.ok&&stale.code==='stale_server_revision');

  Clock.setTimer(state,'production:iron',100000);
  const elapsed=Clock.resolveElapsed(state,'production:iron',{serverNow:160000,maxSeconds:120,rate:.5});
  assert.strictEqual(elapsed.rawSeconds,60);assert.strictEqual(elapsed.usableSeconds,60);assert.strictEqual(elapsed.scaledSeconds,30);
  const duplicate=Clock.resolveElapsed(state,'production:iron',{serverNow:160000,maxSeconds:120});
  assert.strictEqual(duplicate.usableSeconds,0,'same authoritative time paid twice');

  Clock.setTimer(state,'offline:cap',200000);
  const capped=Clock.resolveElapsed(state,'offline:cap',{serverNow:400000,maxSeconds:30});
  assert.strictEqual(capped.usableSeconds,30);assert(capped.wasCapped);
  assert.strictEqual(Clock.resolveElapsed(state,'offline:cap',{serverNow:400000,maxSeconds:30}).usableSeconds,0,'capped time was replayed');

  Clock.setTimer(state,'peek',500000);
  const preview=Clock.peekElapsed(state,'peek',{serverNow:510000,maxSeconds:60});assert.strictEqual(preview.usableSeconds,10);
  const consumed=Clock.resolveElapsed(state,'peek',{serverNow:510000,maxSeconds:60});assert.strictEqual(consumed.usableSeconds,10,'peek consumed timer');

  const created=S.createProfile('Server Clock',state);assert(created.ok);assert(S.save(state));
  state=S.load();const diag=Clock.diagnostics(state);assert(diag.authoritative);assert.strictEqual(diag.authorityRevision,5);assert(diag.timers>=3);
  assert.strictEqual(Clock.resolveElapsed(state,'production:iron',{serverNow:160000,maxSeconds:120}).usableSeconds,0,'timer receipt did not survive v16 roundtrip');

  console.log('PASS u4-1-server-time: authoritative offset, monotonic now, stale sample rejection, lazy elapsed idempotency, cap and v16 persistence');
})();
