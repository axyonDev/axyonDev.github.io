'use strict';
const assert=require('assert');
const {loadRuntime,decimalEq,decimalToString,fillEconomy}=require('./runtime-loader');
const ctx=loadRuntime();
const {Economy:E,Data:D,EconomyNumber:EN,Numbers:N}=ctx.Axyon;
const d=v=>EN.safe(v);
const countNodes=(s,type)=>Object.values(s.map.nodes||{}).filter(n=>n.type===type).length;
const seedItems=(s,cost,mult=1)=>{for(const[k,v]of Object.entries(cost||{}))s.inventory[k]=EN.add(s.inventory[k],EN.mul(v,mult));};
const findCell=(s,id,type='machine')=>{
  for(const sec of E.openSectorList(s))for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)if(E.canPlaceAt(s,id,type,x,y))return[x,y];
  return null;
};

// New-game invariants.
const fresh=E.createInitialState({planetType:'temperate',route:'oil'});
assert.strictEqual(fresh.version,16);
assert(decimalEq(ctx,fresh.coins,0),'new game must start with zero credits');
assert.strictEqual(N.runtimeMode,'decimal-native-u2');
assert.strictEqual(E.openSectorList(fresh).length,1);
assert.strictEqual(Object.keys(fresh.grid.entities).length,7,'starter package not placed exactly once');
assert.strictEqual(countNodes(fresh,'ironOre'),1);assert.strictEqual(countNodes(fresh,'copperOre'),1);assert.strictEqual(countNodes(fresh,'coal'),1);
assert.strictEqual(fresh.firstOrbit.landingReactorPower,120);
E.tick(fresh,30,Date.now()+30000);
assert(EN.gt(fresh.stats.produced.coal,0),'starter production did not run');
assert(fresh.coins instanceof EN.Decimal&&fresh.inventory.coal instanceof EN.Decimal,'economy is not Decimal-native');

// Resource-only construction: credits remain untouched.
const construct=E.createInitialState();construct.researched.basics=true;
const buildId='gearPress',req=E.buildRequirements(construct,buildId);seedItems(construct,req);const buildCell=findCell(construct,buildId);
assert(buildCell,'no build cell');const creditsBefore=decimalToString(ctx,construct.coins);const countBefore=construct.machines[buildId].count;
assert(E.placeMachine(construct,buildId,...buildCell),'resource construction failed');
assert.strictEqual(construct.machines[buildId].count,countBefore+1);assert.strictEqual(decimalToString(ctx,construct.coins),creditsBefore,'pre-orbit construction spent credits');

// First expansion guarantees water and stone; second normal expansion guarantees oil.
const oil=E.createInitialState({route:'oil'});seedItems(oil,E.sectorOpenRequirements());const firstTarget=E.openableSectors(oil)[0];assert(E.openSector(oil,firstTarget.sx,firstTarget.sy));
oil.firstOrbit.sectorScans[0].finishAt=Date.now()-1;E._u2.tickSectorScans(oil,Date.now());
assert.strictEqual(E.openSectorList(oil).length,2);assert(countNodes(oil,'water')>=1&&countNodes(oil,'stone')>=1,'first expansion guarantees missing');
seedItems(oil,E.sectorOpenRequirements());const secondTarget=E.openableSectors(oil)[0];assert(E.openSector(oil,secondTarget.sx,secondTarget.sy));oil.firstOrbit.sectorScans[0].finishAt=Date.now()-1;E._u2.tickSectorScans(oil,Date.now());assert(countNodes(oil,'crudeOil')>=2,'oil route did not discover guaranteed crude oil');

// Oil-free route must not depend on crude oil and receives extra coal.
const synthetic=E.createInitialState({planetType:'frontier',route:'synthetic'});
for(let i=0;i<2;i++){seedItems(synthetic,E.sectorOpenRequirements());const target=E.openableSectors(synthetic)[0];assert(E.openSector(synthetic,target.sx,target.sy));synthetic.firstOrbit.sectorScans[0].finishAt=Date.now()-1;E._u2.tickSectorScans(synthetic,Date.now());}
assert.strictEqual(countNodes(synthetic,'crudeOil'),0,'oil-free route generated crude oil');assert(countNodes(synthetic,'coal')>=3,'oil-free route missing coal fallback');

// Prototype satellite and three guaranteed founding contracts.
const orbit=E.createInitialState();orbit.researched.prototypeOrbitalTrade=true;
const prototype=D.satellites.find(x=>x.id==='prototypeMarketSatellite');seedItems(orbit,prototype.cost);
assert(E.queueSatellite(orbit,'prototypeMarketSatellite',1),'prototype satellite queue failed');orbit.galaxy.satelliteQueue[0].finishAt=Date.now()-1;E._u2.tickSatellites(orbit,Date.now());
assert(orbit.market.prototypeBuilt&&E.marketSatelliteCount(orbit)===1,'prototype satellite did not become operational');
let expectedCredits=0;
for(const contract of D.firstOrbit.foundingContracts){seedItems(orbit,contract.requires);assert(E.startFoundingContract(orbit,contract.id),`contract ${contract.id} failed to start`);orbit.market.contractMissions[0].finishAt=Date.now()-1;E._u2.tickContracts(orbit,Date.now());expectedCredits+=contract.creditReward;assert(decimalEq(ctx,orbit.coins,expectedCredits),`contract ${contract.id} credit mismatch`);}
assert.strictEqual(expectedCredits,13500);assert.strictEqual(orbit.market.foundingContractsCompleted.length,3);assert(E.creditsVisible(orbit));

// Market Mk I consumes exactly 12,000 credits and leaves the guaranteed 1,500.
orbit.researched.prototypeOrbitalTrade=true;orbit.machines.betaLab.count=1;orbit.machineLevels.betaLab=2;seedItems(orbit,D.research.find(t=>t.id==='marketNetworkMk1').cost);
assert(E.doResearch(orbit,'marketNetworkMk1'),`Market Mk I research blocked: ${E.researchMissing(orbit,'marketNetworkMk1').join('; ')}`);
orbit.researchProgress.active.finishAt=Date.now()-1;E.tickResearch(orbit,Date.now());
assert(orbit.researched.marketNetworkMk1&&orbit.market.networkMk===1);assert(decimalEq(ctx,orbit.coins,1500),'Market Mk I did not leave 1,500 guaranteed credits');

// Dynamic market is satellite-only; direct local sales remain disabled.
orbit.market.enabled=true;E.setAllAutoSell(orbit,false);orbit.autoSell.ironPlate=true;E.setAutoSellKeep(orbit,'ironPlate',0);orbit.inventory.ironPlate=d(500);orbit.market.nextDispatchAt=Date.now()-1;
const marketBefore=EN.safe(orbit.coins);E.tick(orbit,.1,Date.now());
assert(orbit.stats.marketDispatches>=4,'market dispatch did not run after contracts');assert(EN.gt(orbit.coins,marketBefore),'dynamic market produced no revenue');assert(EN.lte(orbit.market.lastUnits,E.marketCapacity(orbit)),'market exceeded quota');
const localBefore=EN.safe(orbit.coins);assert(decimalEq(ctx,E.sellFraction(orbit,'ironPlate',1),0));assert(EN.eq(orbit.coins,localBefore),'local selling changed credits');

// Legacy combat and upgrade actions must preserve Decimal storage types.
const compat=E.createInitialState();fillEconomy(ctx,compat,'1e12');D.research.forEach(t=>compat.researched[t.id]=true);
assert(E.upgradeAutomation(compat,'ironMine'));assert(compat.coins instanceof EN.Decimal&&compat.inventory.gear instanceof EN.Decimal,'automation downgraded Decimal values');
assert(E.queueShip(compat,'fighter',1));assert(compat.inventory.steel instanceof EN.Decimal,'ship queue downgraded inventory');
compat.galaxy.scanCooldownUntil=0;assert(E.scanNextTarget(compat));assert(compat.coins instanceof EN.Decimal,'galaxy scan downgraded credits');

// Offline production continues, but due punitive raids receive the preparation window.
const offline=E.createInitialState();offline.lastSeen=Date.now()-3600_000;offline.galaxy.nextRaidAt=offline.lastSeen+1000;const raidCount=offline.stats.raidsWon+offline.stats.raidsLost;
const offlineResult=E.applyOfflineProgress(offline);assert(offlineResult.raidDeferred,'offline raid was not deferred');assert.strictEqual(offline.stats.raidsWon+offline.stats.raidsLost,raidCount,'offline raid resolved silently');assert(offline.galaxy.nextRaidAt>Date.now(),'raid preparation window missing');

// Arbitrary-size values survive normalization without native Number clamping.
const huge=E.normalizeState({version:16,coins:'1e100',inventory:{ironOre:'9e88'}});
assert.strictEqual(decimalToString(ctx,huge.coins),'1e100');assert(EN.gt(huge.inventory.ironOre,'1e88'),'large inventory was clamped');
console.log('PASS u2-first-orbit: Decimal runtime, zero-credit industry, discoveries, Mk0 satellite, guaranteed contracts, Market Mk I, satellite-only sales, legacy bridges and offline raid safety');
