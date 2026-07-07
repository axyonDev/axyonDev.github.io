'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {root,loadRuntime,memoryStorage}=require('./runtime-loader');

// Resume accounting is idempotent: a second resume cannot pay the same period twice.
let clock=1700000000000;
class FakeDate extends Date{static now(){return clock;}}
const ctx=loadRuntime({Date:FakeDate});const E=ctx.Axyon.Economy;
const s=E.createInitialState();for(let i=0;i<20;i++)E.tick(s,1,clock+i*1000);s.lastSeen=clock-600000;
const first=E.applyOfflineProgress(s);const second=E.applyOfflineProgress(s);
assert(first.usableSeconds>=599&&first.usableSeconds<=601,'10-minute resume was not accounted');assert(second.usableSeconds<1,'resume period was paid twice');

// U3 main bridge must react on visible, skip hidden live ticks and show the offline result.
const main=fs.readFileSync(path.join(root,'src/main.js'),'utf8');
for(const token of ["visibilitychange","document.visibilityState==='hidden'","applyResumeProgress()","showOfflineResult(result)","if(document.visibilityState==='hidden'){last=stamp;return;}"])assert(main.includes(token),`background-resume contract missing: ${token}`);

// Save failures become a visible, inspectable blocking condition.
const storage=memoryStorage();const saveCtx=loadRuntime({Date:FakeDate,localStorage:storage,saveService:true});
const initial=saveCtx.Axyon.Economy.createInitialState();assert(saveCtx.Axyon.SaveService.createProfile('Test Komutanı',initial).ok);
const originalSet=storage.setItem.bind(storage);let fail=false;storage.setItem=(k,v)=>{if(fail&&String(k).includes('axyon_frontier_save_'))throw new Error('QuotaExceededError test');return originalSet(k,v);};
fail=true;{const oldError=console.error;console.error=()=>{};try{assert.strictEqual(saveCtx.Axyon.SaveService.save(initial),false,'save failure returned success');}finally{console.error=oldError;}}assert(saveCtx.Axyon.SaveService.diagnostics().blockingError,'save failure was not surfaced in diagnostics');assert(main.includes('axyon:save-error')&&main.includes('save-warning'),'save failure has no visible UI bridge');

// U3 save round-trip preserves cohorts and infrastructure.
fail=false;saveCtx.Axyon.SaveService.clearBlockingError();initial.planetary.defenseCohorts.ballisticTurret=1234;initial.galaxy.defenses.ballisticTurret=1234;initial.planetary.assets.coolingHub=3;assert(saveCtx.Axyon.SaveService.save(initial));const loaded=saveCtx.Axyon.SaveService.load();assert.strictEqual(loaded.planetary.defenseCohorts.ballisticTurret,1234);assert.strictEqual(loaded.planetary.assets.coolingHub,3);

// Touch and brand contracts.
const canvas=fs.readFileSync(path.join(root,'src/canvas/factory-canvas.js'),'utf8');for(const token of ['activePointers = new Map()','function beginPinch','function updatePinch','activePointers.size>=2','function viewBounds','function drawGrid(side,v)','FactoryCanvas.getCamera'])assert(canvas.includes(token),`pinch contract missing: ${token}`);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));assert.strictEqual(manifest.name,'AXYON: Orbital Ascendancy — Data Vault');assert.strictEqual(manifest.version,'4.5.0-u4');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(index.includes('viewport-fit=cover'));assert(index.includes('AXYON: Orbital Ascendancy'));assert(index.includes('data-tab="infrastructure"'));assert(index.includes('aria-selected'));
const css=fs.readFileSync(path.join(root,'css/style.css'),'utf8');assert(css.includes('safe-area-inset-top')&&css.includes('prefers-reduced-motion'));
console.log('PASS u3-background-save-brand: idempotent 10-minute resume, visible save failure, U3 persistence, pinch and Orbital Ascendancy metadata');
