'use strict';
const assert=require('assert');
const {loadRuntime,fillEconomy}=require('./runtime-loader');
const ctx=loadRuntime();
const {Economy:E,Data:D,EconomyNumber:EN}=ctx.Axyon;
const unlock=s=>{fillEconomy(ctx,s,'1e18');D.research.forEach(t=>s.researched[t.id]=true);E.tick(s,.1,Date.now());};

const s=E.createInitialState();
assert.strictEqual(D.game.title,'AXYON: Orbital Ascendancy');
assert.strictEqual(D.game.version,'4.5.5-u4.3.2');
assert(s.planetary&&s.planetary.complexes&&s.planetary.defenseCohorts,'planetary runtime state missing');
let cap=E.capacityStatus(s);
for(const k of ['surface','planet','orbitalMass','orbitalSlots','command','heat','maintenance','power'])assert(cap[k]&&Number.isFinite(cap[k].used)&&Number.isFinite(cap[k].max),`capacity axis missing ${k}`);
assert(cap.ok&&!s.planetary.legacyOverflow,'starter factory begins over capacity');
assert.strictEqual(E.canBuildAsset(s,'coolingHub'),false,'cooling hub ignored its technology lock');
assert(E.researchUnlocks('planetaryLogistics').some(x=>x.includes('Soğutma Merkezi')),'infrastructure asset missing from research unlock list');
assert(E.researchUnlocks('defenseGrid').some(x=>x.includes('Yüzey Savunma Kompleksi')),'defense complex missing from research unlock list');
for(const id of ['scrapMetal','wreckCircuit','alienAlloy'])assert(D.items[id].externalSource,`${id} lost its warfront source description`);

// Old v4.3 defenses migrate into canonical cohorts without deletion.
const legacy=E.createInitialState();legacy.galaxy.defenses.turret=7;legacy.galaxy.defenses.interceptor=9;legacy.galaxy.defenses.shield=2;delete legacy.planetary;
const migrated=E.normalizeState(legacy);
assert.strictEqual(migrated.planetary.defenseCohorts.ballisticTurret,7);
assert.strictEqual(migrated.planetary.defenseCohorts.interceptorDrone,9);
assert.strictEqual(migrated.planetary.defenseCohorts.planetaryShieldCore,2);
assert.strictEqual(migrated.galaxy.defenses.turret,0);

// Cohort building, failsafe cap and operational ratios.
unlock(s);s._power={supply:10000,demand:0,connectedDemand:0,delivered:10000,ratio:1};
assert(E.buildDefense(s,'ballisticTurret',100),'ballistic cohort could not be built');
assert(E.buildDefense(s,'emergencyBarrier',5),'5% emergency barrier could not be built');
assert(!E.buildDefense(s,'emergencyBarrier',1),'emergency barrier exceeded 5% share');
assert.strictEqual(s.planetary.defenseCohorts.ballisticTurret,100);
assert.strictEqual(s.planetary.defenseCohorts.emergencyBarrier,5);
s._power={supply:10000,demand:0,ratio:1};s.inventory.ammunition=EN.safe(0);
let stats=E.defenseStats(s);
assert.strictEqual(stats.byType.ballisticTurret.ratio,0,'ammo-free ballistic cohort remained operational');
assert.strictEqual(stats.byType.emergencyBarrier.ratio,1,'emergency barrier requires energy or ammo');
s.inventory.ammunition=EN.safe('1e9');stats=E.defenseStats(s);assert(stats.byType.ballisticTurret.ratio>.99,'munitioned cohort did not recover');

// Cooling assets must be buildable as a recovery path even when heat is slightly over capacity.
const recovery=E.createInitialState();unlock(recovery);recovery.map.openSectors['8,7']=true;recovery.sectorsOpened=2;recovery.planetary.defenseCohorts.laserPoint=10000;recovery.galaxy.defenses.laserPoint=10000;recovery._power={supply:1e8,demand:0,ratio:1};
assert(E.capacityStatus(recovery).heat.used>E.capacityStatus(recovery).heat.max,'heat overflow fixture is invalid');
assert(E.canBuildAsset(recovery,'coolingHub'),'cooling hub cannot resolve an existing heat overflow');
assert(E.buildAsset(recovery,'coolingHub'),'cooling hub build failed');
assert(E.capacityStatus(recovery).heat.max>E.capacityStatus(recovery).heat.used,'cooling hub did not resolve heat overflow');

// Satellite queues use real orbital slots; spy satellites do not consume the 3/6/9 market count.
const orbit=E.createInitialState();unlock(orbit);orbit.researched.espionageNetwork=true;
assert(E.queueSatellite(orbit,'spySatellite',8),'eight spy satellites should fit base orbital slots');
assert(!E.canBuildSatellite(orbit,'spySatellite',1),'ninth spy satellite bypassed base orbital slots');
assert.strictEqual(E.marketSatelliteCount(orbit),0,'spy satellites leaked into market-satellite count');

// Removing a building recalculates inheritance overflow and never freezes future placement.
const removable=E.createInitialState();unlock(removable);let cell=null;
for(const sec of E.openSectorList(removable))for(let y=sec.sy*20;y<(sec.sy+1)*20&&!cell;y++)for(let x=sec.sx*20;x<(sec.sx+1)*20;x++)if(E.canPlaceAt(removable,'gearPress','machine',x,y)){cell=[x,y];break;}
const eid=cell&&E.placeMachine(removable,'gearPress',...cell);assert(eid,'placement fixture failed');assert(E.removeEntity(removable,eid),'entity removal failed');assert(!removable.planetary.legacyOverflow,'removal left a stale capacity lock');assert(E.canBuild(removable,'gearPress'),'building could not be constructed after removal');

// Million-unit defense remains a stack, not a million JS objects.
const fortress=E.createInitialState();unlock(fortress);for(let sy=0;sy<15;sy++)for(let sx=0;sx<15;sx++)fortress.map.openSectors[`${sx},${sy}`]=true;fortress.sectorsOpened=225;
fortress.planetary.infrastructureLevel=10;fortress.planetary.orbitalLevel=10;fortress.planetary.commandLevel=15;fortress.planetary.complexes.surfaceDefenseComplex={count:12,mk:5};fortress.planetary.assets.coolingHub=10;fortress.planetary.assets.maintenanceDepot=10;fortress.planetary.assets.commandArray=10;fortress._power={supply:1e12,demand:0,ratio:1};fortress.inventory.ammunition=EN.safe('1e15');fortress.planetary.defenseCohorts.interceptorDrone=1000000;fortress.galaxy.defenses.interceptorDrone=1000000;
const start=process.hrtime.bigint(),millionStats=E.defenseStats(fortress),elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
assert.strictEqual(millionStats.total,1000000);assert(!Array.isArray(fortress.planetary.defenseCohorts.interceptorDrone));assert(elapsedMs<250,`million cohort calculation too slow: ${elapsedMs.toFixed(2)} ms`);

// Capacity overload reduces live production rather than corrupting the state.
fortress.planetary.defenseCohorts.laserPoint=5000000;fortress.galaxy.defenses.laserPoint=5000000;const ratio=E.productionCapacityRatio(fortress);assert(ratio>=0&&ratio<1,'capacity overload did not produce a controlled efficiency penalty');
console.log(`PASS u3-capacity-defense: multi-axis limits, legacy mapping, recovery assets, orbital slots, safe removal and 1,000,000-unit cohort in ${elapsedMs.toFixed(2)} ms`);
