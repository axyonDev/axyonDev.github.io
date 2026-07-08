'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {root,loadRuntime,memoryStorage}=require('./runtime-loader');

let clock=1700000000000;
class FakeDate extends Date{static now(){return clock;}}

function makeRuntime(){
  const storage=memoryStorage(),ctx=loadRuntime({Date:FakeDate,localStorage:storage,saveService:true});
  const state=ctx.Axyon.Economy.createInitialState();
  assert(ctx.Axyon.SaveService.createProfile('Recovery Test',state).ok);
  return{storage,ctx,state,S:ctx.Axyon.SaveService};
}

// Manual retry: a transient write failure can recover immediately without page reload.
{
  const {storage,state,S}=makeRuntime();
  const originalSet=storage.setItem.bind(storage);let fail=true,writeAttempts=0;
  storage.setItem=(k,v)=>{if(String(k).includes('axyon_frontier_save_')){writeAttempts++;if(fail)throw new Error('transient quota');}return originalSet(k,v);};
  {const oldError=console.error;console.error=()=>{};try{assert.strictEqual(S.save(state),false);}finally{console.error=oldError;}}
  const blocked=S.diagnostics();
  assert.strictEqual(blocked.blockingError.type,'save');
  assert.strictEqual(blocked.nextSaveRetryAt,clock+30000);
  const afterFailureAttempts=writeAttempts;
  assert.strictEqual(S.save(state),false,'cooldown save should not claim success');
  assert.strictEqual(writeAttempts,afterFailureAttempts,'cooldown should not hammer storage');
  fail=false;
  assert.strictEqual(S.retrySave(state),true,'manual retry did not recover');
  assert.strictEqual(S.diagnostics().blockingError,null,'successful retry did not clear blocking error');
  assert(S.rawActiveSave(),'recovered save payload missing');
}

// Automatic retry: the ordinary autosave path retries after the controlled cooldown.
{
  const {storage,state,S}=makeRuntime();
  const originalSet=storage.setItem.bind(storage);let fail=true;
  storage.setItem=(k,v)=>{if(fail&&String(k).includes('axyon_frontier_save_'))throw new Error('temporary storage stall');return originalSet(k,v);};
  {const oldError=console.error;console.error=()=>{};try{assert.strictEqual(S.save(state),false);}finally{console.error=oldError;}}
  fail=false;clock+=29999;
  assert.strictEqual(S.save(state),false,'save retried before cooldown elapsed');
  clock+=1;
  assert.strictEqual(S.save(state),true,'autosave path did not recover after cooldown');
  assert.strictEqual(S.diagnostics().blockingError,null);
}

// Structural load/migration failures remain protected from retry and public clearing.
{
  const {storage,S}=makeRuntime(),id=S.currentProfileId(),key=S.keys.SAVE_PREFIX+id;
  storage.setItem(key,JSON.stringify({version:16,schemaVersion:16,economy:{}}));
  S.load();
  assert.strictEqual(S.diagnostics().blockingError.type,'migration');
  assert.strictEqual(S.clearBlockingError(),false,'structural error was incorrectly cleared');
  assert.strictEqual(S.retrySave({}),false,'structural error was incorrectly retryable');
  assert.strictEqual(S.diagnostics().blockingError.type,'migration');
}

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');
assert(index.includes('id="save-warning-retry"'),'retry button missing');
assert(index.includes('aria-live="assertive"'),'save warning live region missing');
assert(index.includes('id="ticker-toggle"')&&index.includes('aria-expanded="false"')&&index.includes('aria-controls="ticker-list"'),'ticker ARIA contract missing');
assert(main.includes("setAttribute('aria-expanded'"),'ticker ARIA state is not synchronized');
assert(/\.icon-btn\s*\{[^}]*width:44px;[^}]*height:44px;/.test(css),'icon touch target is below 44px');
assert(/\.fx-zoom\s*\{[^}]*width:44px;[^}]*height:44px;/.test(css),'zoom touch target is below 44px');
console.log('PASS u3.1-save-recovery-accessibility: manual/automatic retry, structural lock protection, 44px and ARIA contracts');
