'use strict';
const assert=require('assert');
const {loadRuntime,fillEconomy,decimalEq}=require('./runtime-loader');
const ctx=loadRuntime();
const {Economy:E,Data:D,Quests:Q,EconomyNumber:EN}=ctx.Axyon;
const seedAll=(s,value='1e15')=>{fillEconomy(ctx,s,value);};

const s=E.createInitialState();
assert.strictEqual(s.version,16);assert.strictEqual(D.map.size,300);assert.strictEqual(E.sectorsPerSide(),15);assert.strictEqual(E.openSectorList(s).length,1);assert(!('nexus'in s)&&!('prestigeCount'in s));
for(let i=0;i<300;i++)E.tick(s,.1,Date.now()+i*100);
assert(EN.gt(s.stats.produced.coal,0),'starter extraction failed');assert(EN.gt(s.stats.produced.alphaCore,0),'starter research-data chain failed');

// Existing Mk/automation systems remain playable through the Decimal bridge.
seedAll(s);D.research.forEach(t=>s.researched[t.id]=true);
assert(E.upgradeAutomation(s,'ironMine'));assert(E.automationLevel(s,'ironMine')>=2);
assert(E.doUpgradeClass(s,'ironMine','machine'));assert.strictEqual(E.machineLevel(s,'ironMine'),2);
assert(s.coins instanceof EN.Decimal&&s.inventory.gear instanceof EN.Decimal,'legacy upgrade downgraded economy values');

// Galaxy battle, return, resurgence and colonization remain functional.
s.galaxy.scanCooldownUntil=0;const target=E.scanNextTarget(s);assert(target&&target.discovered,'galaxy scan failed');s.galaxy.ships.dreadnought=20;
assert(E.sendFleet(s,target.id,{dreadnought:8}),'fleet launch failed');const mission=s.galaxy.missions[0];E.tick(s,1,mission.arrivalAt+1);assert.strictEqual(mission.status,'returning');E.tick(s,1,mission.returnAt+1);assert.strictEqual(s.galaxy.missions.length,0);assert.strictEqual(s.stats.battlesWon+s.stats.battlesLost,1);
target.defeated=true;target.colonized=false;target.recoveryAt=Date.now()-1;const oldStrength=target.strength;E.tick(s,.1,Date.now());assert(!target.defeated&&target.strength>oldStrength,'enemy resurgence failed');
target.defeated=true;s.galaxy.ships.colonyShip=1;assert(E.colonizeTarget(s,target.id),'invasion launch failed');const invasion=s.galaxy.missions.find(m=>m.type==='invasion');E.tick(s,1,invasion.arrivalAt+1);E.tick(s,1,invasion.returnAt+1);assert.strictEqual(s.galaxy.colonies,2);

// Raid reports damage without deleting the spatial factory.
const entitiesBefore=Object.keys(s.grid.entities).length;s.galaxy.nextRaidAt=Date.now()-1;E.tick(s,.1,Date.now());assert.strictEqual(Object.keys(s.grid.entities).length,entitiesBefore);assert.strictEqual(s.stats.raidsWon+s.stats.raidsLost,1);

// v8 spatial migration refunds legacy investment and restores the v4.4 starter base.
const old={version:8,coins:1234,inventory:{ironOre:77},machines:{ironMine:{count:4,hasManager:true,eff:1,milestoneMult:1}},plants:{},researched:{basics:true},map:{openSectors:{'0,0':true},nodes:{},nodeNextSeed:1},grid:{entities:{old:{id:'old',type:'machine',defId:'ironMine',x:1,y:1}},conveyors:[],powerLines:[],nextId:2},stats:{produced:{ironOre:5}}};
const migrated=E.normalizeState(old);assert.strictEqual(migrated.version,16);assert(EN.gte(migrated.coins,1234));assert(decimalEq(ctx,migrated.inventory.ironOre,77));assert.strictEqual(migrated.machines.ironMine.count,1,'legacy machines were not replaced by starter package');assert.strictEqual(Object.keys(migrated.grid.entities).length,7);

// A modern spatial save must preserve the existing 300x300 factory.
const modern=E.createInitialState();modern.version=12;seedAll(modern,'999999');modern.researched.basics=true;const req=E.buildRequirements(modern,'gearPress');for(const[k,v]of Object.entries(req))modern.inventory[k]=EN.add(modern.inventory[k],v);let cell=null;for(const sec of E.openSectorList(modern))for(let y=sec.sy*20;y<(sec.sy+1)*20&&!cell;y++)for(let x=sec.sx*20;x<(sec.sx+1)*20;x++)if(E.canPlaceAt(modern,'gearPress','machine',x,y)){cell=[x,y];break;}assert(cell&&E.placeMachine(modern,'gearPress',...cell));const ids=Object.keys(modern.grid.entities),modernCoins=EN.toStorage(modern.coins);const restored=E.normalizeState(JSON.parse(JSON.stringify(modern)));assert.strictEqual(restored.version,16);assert.strictEqual(EN.toStorage(restored.coins),modernCoins);assert.strictEqual(Object.keys(restored.grid.entities).length,ids.length);

// Every main technology must be reachable when its declared infrastructure is present.
const longGame=E.createInitialState();seedAll(longGame);D.machines.forEach(d=>{longGame.machines[d.id].count=5;longGame.machines[d.id].hasManager=true;longGame.machines[d.id].automationLevel=1;longGame.machineLevels[d.id]=5;});
for(let sy=0;sy<6;sy++)for(let sx=0;sx<8;sx++)longGame.map.openSectors[`${sx},${sy}`]=true;
for(const type of Object.keys(D.resourceNodes)){longGame.map.nodes[`${(Object.keys(longGame.map.nodes).length%200)+1},${Math.floor(Object.keys(longGame.map.nodes).length/200)+1}`]={type};}
D.ships.forEach(d=>longGame.galaxy.ships[d.id]=20);longGame.galaxy.satellites.prototypeMarketSatellite=1;longGame.galaxy.satellites.marketSatellite=9;longGame.market.prototypeBuilt=true;longGame.market.creditEconomyUnlocked=true;longGame.market.foundingContractsCompleted=D.firstOrbit.foundingContracts.map(c=>c.id);longGame.stats.battlesWon=20;
const pending=new Set(D.research.map(t=>t.id));let guard=0;while(pending.size&&guard++<D.research.length*3){let progressed=false;for(const id of [...pending]){if(!E.canResearch(longGame,id))continue;assert(E.doResearch(longGame,id),`research start failed ${id}`);longGame.researchProgress.active.finishAt=Date.now()-1;E.tickResearch(longGame,Date.now());assert(longGame.researched[id],`research did not finish ${id}`);pending.delete(id);progressed=true;}if(!progressed)break;}assert.strictEqual(pending.size,0,`unreachable technologies: ${[...pending].map(id=>id+': '+E.researchMissing(longGame,id).join(', ')).join(' | ')}`);
assert.strictEqual(Object.keys(longGame.researched).length,D.research.length);
longGame.plants.solarArray.count=1;for(let lv=longGame.machineLevels.ironMine+1;lv<=5;lv++)assert(E.doUpgradeClass(longGame,'ironMine','machine'));for(let lv=2;lv<=5;lv++)assert(E.doUpgradeClass(longGame,'solarArray','plant'));assert.strictEqual(E.machineLevel(longGame,'ironMine'),5);assert.strictEqual(E.plantLevel(longGame,'solarArray'),5);

// Quest progression uses sectorsOpened, not stale legacy fields.
s.sectorsOpened=1;s.questIndex=D.quests.findIndex(q=>q.type==='landExpand');assert(Q.questProgress(s).done,'sector quest regression');
console.log('PASS smoke-core U2: 300x300 starter factory, Decimal upgrades, galaxy, raids, migrations, complete research DAG, Mk V and quests');
