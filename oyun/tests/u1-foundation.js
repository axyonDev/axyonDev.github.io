'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {root,loadRuntime,memoryStorage,decimalEq,decimalToString}=require('./runtime-loader');
const localStorage=memoryStorage(),ctx=loadRuntime({localStorage,saveService:true});
const {SaveService:S,SaveMigratorV16:M,Canonical:C,EconomyNumber:EN,Numbers:N}=ctx.Axyon;
assert.strictEqual(M.sha256('abc'),crypto.createHash('sha256').update('abc').digest('hex'));
assert.strictEqual(C.version,'4.4.0');assert.strictEqual(C.counts.items,52);assert.strictEqual(C.counts.machines,50);assert.strictEqual(C.counts.technologies,52);assert.strictEqual(C.counts.repeatableTechnologies,12);
const created=S.createProfile('U2 Test');assert(created.ok);
let raw=JSON.parse(S.rawActiveSave());assert.strictEqual(raw.version,16);assert.strictEqual(raw.economy.credits,'0');assert.strictEqual(typeof raw.inventory.ironOre,'string');assert(raw.firstOrbit&&raw.firstOrbit.starterApplied);
let state=S.load();state.coins=EN.safe('1e100');state.inventory.ironOre=EN.safe('9e88');assert(S.save(state));raw=JSON.parse(S.rawActiveSave());assert.strictEqual(raw.economy.credits,'1e100');assert(EN.eq(EN.fromStorage(raw.inventory.ironOre),'9e88'));
state=S.load();assert.strictEqual(decimalToString(ctx,state.coins),'1e100');assert(EN.eq(state.inventory.ironOre,'9e88'),'Decimal runtime round-trip lost precision');

const activeKey=S.keys.SAVE_PREFIX+S.currentProfileId();
const unsafe=fs.readFileSync(path.join(root,'tests/fixtures/v15/legacy-market-mk2-unsafe.json'),'utf8');localStorage.setItem(activeKey,unsafe);state=S.load();assert(!S.hasBlockingError(),'unsafe v15 migration blocked');raw=JSON.parse(localStorage.getItem(activeKey));assert.strictEqual(raw.version,16);assert.strictEqual(raw.economy.credits,'9007199254740993123456789');assert([...localStorage._store.keys()].some(k=>k.startsWith(activeKey+'.backup.v15.')),'immutable v15 backup missing');assert(EN.eq(state.coins,'9007199254740993123456789'),'unsafe integer changed numerically at runtime');assert(state.market.legacyAccess&&state.market.networkMk>=1,'legacy market inheritance missing');assert(S.save(state));assert.strictEqual(JSON.parse(localStorage.getItem(activeKey)).economy.credits,'9007199254740993123456789');
const exported=S.exportString(state),imported=S.importString(exported);assert(imported.ok);assert(EN.eq(imported.state.coins,'9007199254740993123456789'));assert.strictEqual(S._test.encodeRuntime(imported.state).economy.credits,'9007199254740993123456789');

const corrupt=fs.readFileSync(path.join(root,'tests/fixtures/v15/corrupt-truncated.json'),'utf8');localStorage.setItem(activeKey,corrupt);const recovery=S.load();assert(S.hasBlockingError());assert.strictEqual(localStorage.getItem(activeKey),corrupt);assert.strictEqual(S.save(recovery),false);const reset=S.resetCurrent({theme:'dark'});assert(!S.hasBlockingError());raw=JSON.parse(localStorage.getItem(activeKey));assert.strictEqual(raw.version,16);assert.strictEqual(raw.economy.credits,'0');assert.strictEqual(Object.keys(reset.grid.entities).length,0);assert.strictEqual(ctx.Axyon.Economy.starterFreeRemaining(reset,'ironMine'),1);
assert.strictEqual(EN.engine,'break_eternity.js@2.1.3');assert.strictEqual(N.runtimeMode,'decimal-native-u2');
console.log('PASS U2 foundation: canonical loader, Decimal-native v16 storage, exact unsafe migration, rollback, reset recovery and export/import');
