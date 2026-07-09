'use strict';
const assert=require('assert');
const {loadRuntime,fillEconomy}=require('./runtime-loader');
const deterministicMath=Object.create(Math);deterministicMath.random=()=>0.5;
const ctx=loadRuntime({Math:deterministicMath});
const {Economy:E,Data:D,EconomyNumber:EN}=ctx.Axyon;
const fill=s=>{fillEconomy(ctx,s,'1e15');D.research.forEach(t=>s.researched[t.id]=true);};

// Five-step automation keeps real gates and preserves Decimal economy values.
const a=E.createInitialState();fill(a);a.machines.ironMine.count=1;a.machines.ironMine.automationLevel=0;a.machines.ironMine.hasManager=false;const baseRate=E.machineRate(a,'ironMine');
for(let level=1;level<=5;level++){assert(E.upgradeAutomation(a,'ironMine'),`automation ${level} failed`);assert.strictEqual(E.automationLevel(a,'ironMine'),level);}
assert(E.machineRate(a,'ironMine')>baseRate);assert(E.machinePowerDemand(a,'ironMine')<D.machines.find(x=>x.id==='ironMine').power*1.25);assert(a.coins instanceof EN.Decimal);

// Manual click remains one-machine burst regardless of count.
const clickOne=E.createInitialState();fill(clickOne);clickOne.machines.ironMine.count=1;clickOne.inventory.ironOre=EN.safe(0);const one=E.manualClick(clickOne,'ironMine');
const clickMany=E.createInitialState();fill(clickMany);clickMany.machines.ironMine.count=100;clickMany.inventory.ironOre=EN.safe(0);const many=E.manualClick(clickMany,'ironMine');
assert(EN.subSigned(one,many).abs().lt('1e-9'),'manual click scaled with machine count');

// Damage reservation and parallel repair facilities.
const m=E.createInitialState();fill(m);m.maintenance.facilities.planetWorkshop=1;m.maintenance.facilities.orbitalDrydock=1;m.maintenance.facilities.satelliteHub=1;m.maintenance.integrity.planet=85;m.maintenance.integrity.orbital=80;m.maintenance.damagedShips.fighter=3;
assert(E.queueRepair(m,'zone','planet',10));assert.strictEqual(E.repairAvailableAmount(m,'zone','planet'),5);assert(!E.canQueueRepair(m,'zone','planet',10));assert(E.queueRepair(m,'ship','fighter',2));
const planetJob=m.maintenance.repairQueue.find(j=>j.kind==='zone'),shipJob=m.maintenance.repairQueue.find(j=>j.kind==='ship');assert(planetJob&&shipJob);assert(Math.abs(planetJob.startedAt-shipJob.startedAt)<1000);
planetJob.finishAt=Date.now()-1;shipJob.finishAt=Date.now()-1;E.tickMaintenance(m,Date.now());assert.strictEqual(m.maintenance.integrity.planet,95);assert.strictEqual(m.galaxy.ships.fighter,2);assert.strictEqual(m.maintenance.damagedShips.fighter,1);assert.strictEqual(m.stats.repairsCompleted,12);

// Battle report, cargo limit, salvage and damaged pools.
const b=E.createInitialState();fill(b);b.galaxy.ships.dreadnought=8;b.inventory.starFuel=EN.safe('1e9');const target=b.galaxy.targets[0];target.discovered=true;target.strength=10;target.distance=1;
assert(E.sendFleet(b,target.id,{dreadnought:8}));const mission=b.galaxy.missions[0];E.tick(b,.1,mission.arrivalAt+1);assert.strictEqual(mission.status,'returning');const report=b.galaxy.reports.find(r=>r.details?.category==='battle');assert(report&&report.details.rounds.length>=1);assert(report.details.cargo.used<=report.details.cargo.capacity);assert(report.details.operational&&report.details.damaged&&report.details.lost);E.tick(b,.1,mission.returnAt+1);assert.strictEqual(b.galaxy.missions.length,0);assert(b.inventory.starFuel instanceof EN.Decimal);

// Annihilated fleet cannot carry salvage home.
const z=E.createInitialState();fill(z);z.galaxy.ships.scout=1;z.inventory.starFuel=EN.safe('1e9');const doom=z.galaxy.targets[0];doom.discovered=true;doom.strength=1e12;doom.distance=1;assert(E.sendFleet(z,doom.id,{scout:1}));const doomed=z.galaxy.missions[0];E.tick(z,.1,doomed.arrivalAt+1);const doomReport=z.galaxy.reports.find(r=>r.details?.category==='battle');assert.strictEqual(doomReport.details.cargo.capacity,0);assert.strictEqual(Object.values(doomReport.details.salvage||{}).reduce((x,y)=>x+y,0),0);

// Raid damages infrastructure without deleting factories.
const r=E.createInitialState();fill(r);r.market.prototypeBuilt=true;r.galaxy.satellites.prototypeMarketSatellite=1;E.initializeThreatState(r,Date.now());for(const d of D.defenses)r.galaxy.defenses[d.id]=100;r.inventory.ammunition=EN.safe('1e9');r.galaxy.threat=3;const entities=Object.keys(r.grid.entities).length;r.galaxy.nextRaidAt=Date.now()-1;E.tick(r,.1,Date.now());const raid=r.galaxy.reports.find(x=>x.details?.category==='raid');assert(raid&&raid.details.phases.length===3);assert.strictEqual(Object.keys(r.grid.entities).length,entities);assert(['planet','orbital','satellite'].some(k=>r.maintenance.integrity[k]<100));

// Procedural frontier continues after fixed targets.
const f=E.createInitialState();fill(f);f.market.prototypeBuilt=true;f.galaxy.satellites.prototypeMarketSatellite=1;E.initializeThreatState(f,Date.now());f.galaxy.targets.forEach(t=>t.discovered=true);f.galaxy.scanCooldownUntil=0;const frontier=E.scanNextTarget(f);assert(frontier&&frontier.procedural&&frontier.frontierDepth===1);f.galaxy.scanCooldownUntil=0;frontier.defeated=true;f.galaxy.frontierGenerated=1;const frontier2=E.scanNextTarget(f);assert(frontier2&&frontier2.frontierDepth===2);assert(frontier2.strength>frontier.strength&&frontier2.distance>frontier.distance);

// Older modern saves normalize into v16 with maintenance defaults.
const old=E.createInitialState();old.version=13;old.coins=EN.safe(4321);old.maintenance=undefined;const migrated=E.normalizeState(JSON.parse(JSON.stringify(old)));assert.strictEqual(migrated.version,16);assert(EN.eq(migrated.coins,4321));assert.strictEqual(migrated.maintenance.integrity.planet,100);assert(Array.isArray(migrated.maintenance.repairQueue));
console.log('PASS warfront-maintenance U2: Decimal-safe automation/actions, bounded click, repairs, detailed combat, salvage, raids, frontier and migration');
