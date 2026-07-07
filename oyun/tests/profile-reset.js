'use strict';
const assert=require('assert');
const {loadRuntime,memoryStorage,decimalEq,decimalToString}=require('./runtime-loader');
const localStorage=memoryStorage(),ctx=loadRuntime({localStorage,saveService:true});
const {Economy:E,SaveService:S,EconomyNumber:EN}=ctx.Axyon;
assert.strictEqual(S.bootstrap(),null,'first launch must wait for commander name');
assert.strictEqual(S.listProfiles().length,0);assert.strictEqual(S.load(),null);
const initial=S.createProfile('Ahmet');assert(initial.ok,'first commander creation failed');
let state=S.load();state.coins=EN.safe(987654);state.inventory.ironOre=EN.safe(444);state.topScore=EN.safe(12345);state.sectorsOpened=9;state.researched.basics=true;state.galaxy.ships.fighter=5;state.galaxy.reports.push({id:'test-report',title:'Test'});state.maintenance.integrity.planet=41;state.maintenance.damagedShips.fighter=3;state.maintenance.repairQueue.push({id:'repair-test'});state.repeatResearch.repairEfficiency=7;assert(S.save(state));
const first=S.currentProfileId(),created=S.createProfile('Sevcan');assert(created.ok&&S.currentProfileId()!==first);
const unsafe=S.createProfile('<img onerror=alert(1)> Ahmet');assert(unsafe.ok&&!/[<>'"&`]/.test(unsafe.profile.name));assert(S.deleteProfile(unsafe.profile.id));assert(S.selectProfile(created.profile.id));
let second=S.load();assert(decimalEq(ctx,second.coins,0)&&decimalEq(ctx,second.inventory.ironOre,0),'profiles leaked economy');assert.strictEqual(Object.keys(second.grid.entities).length,7,'fresh profile starter package missing');
assert(S.selectProfile(first));state=S.load();assert(decimalEq(ctx,state.coins,987654)&&decimalEq(ctx,state.inventory.ironOre,444),'first profile state lost');

const malformed=E.normalizeState({version:16,coins:'NaN',inventory:{ironOre:'-50',copperOre:'Infinity'},machines:{ironMine:{count:'Infinity',automationLevel:99}},maintenance:{integrity:{planet:'bad',orbital:-25,satellite:999}},map:{openSectors:{'bad':true},nodes:{}},grid:{entities:{broken:{type:'machine',defId:'missing',x:'x',y:0}}}});
assert(decimalEq(ctx,malformed.coins,0));assert(decimalEq(ctx,malformed.inventory.ironOre,0)&&decimalEq(ctx,malformed.inventory.copperOre,0));assert.strictEqual(malformed.machines.ironMine.automationLevel,5);assert.strictEqual(malformed.maintenance.integrity.planet,100);assert.strictEqual(malformed.maintenance.integrity.orbital,0);assert.strictEqual(malformed.maintenance.integrity.satellite,100);assert.strictEqual(E.openSectorList(malformed).length,1);assert.strictEqual(Object.keys(malformed.grid.entities).length,7,'invalid state did not recover starter factory');

const fresh=S.resetCurrent({theme:'light'});assert(decimalEq(ctx,fresh.coins,0),'credits not reset to zero');assert(decimalEq(ctx,fresh.inventory.ironOre,0),'inventory not reset');assert(decimalEq(ctx,fresh.topScore,0));assert.strictEqual(fresh.sectorsOpened,0);assert(!fresh.researched.basics);assert.strictEqual(fresh.repeatResearch.repairEfficiency,0);assert.strictEqual(fresh.galaxy.ships.fighter,0);assert.strictEqual(fresh.galaxy.reports.length,0);assert.strictEqual(fresh.maintenance.integrity.planet,100);assert.strictEqual(fresh.maintenance.damagedShips.fighter,0);assert.strictEqual(fresh.maintenance.repairQueue.length,0);assert.strictEqual(E.openSectorList(fresh).length,1);assert.strictEqual(Object.keys(fresh.grid.entities).length,7);assert.strictEqual(fresh.machines.ironMine.automationLevel,1,'starter automation was not restored');assert.strictEqual(fresh.market.prototypeBuilt,false);assert.strictEqual(fresh.market.foundingContractsCompleted.length,0);assert.strictEqual(fresh.settings.theme,'light');
assert(S.save(fresh));const reloaded=S.load();assert(decimalEq(ctx,reloaded.coins,0)&&decimalEq(ctx,reloaded.topScore,0),'reset overwritten by stale autosave');
assert(S.deleteProfile(first));assert(!S.listProfiles().some(p=>p.id===first));
console.log('PASS profile-reset U2: isolated profiles, zero-credit reset, Decimal sanitization, starter recovery and deletion');
