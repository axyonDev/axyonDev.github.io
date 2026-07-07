const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const deterministicMath=Object.create(Math);deterministicMath.random=()=>0.5;
const ctx={console,Date,Math:deterministicMath,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['data/feature-flags.js','vendor/break_eternity/break_eternity.min.js','src/core/economy-number.js','src/core/lossless-json.js','src/services/save-migrator-v16.js','data/canonical/game-data.v4.4.final.js','src/core/canonical-data-loader.js','src/core/numbers.js','data/config.js','src/core/economy.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const {Economy:E,Data:D}=ctx.Axyon,assert=(x,m)=>{if(!x)throw new Error(m)};
const fill=s=>{s.coins=1e15;Object.keys(D.items).forEach(k=>s.inventory[k]=1e12);D.research.forEach(t=>s.researched[t.id]=true);};

// Five-step automation must have real technology/material gates and measurable output effects.
const a=E.createInitialState();fill(a);a.machines.ironMine.count=1;const baseRate=E.machineRate(a,'ironMine');
for(let level=1;level<=5;level++){assert(E.upgradeAutomation(a,'ironMine'),`automation level ${level} failed`);assert(E.automationLevel(a,'ironMine')===level,`automation level ${level} not recorded`);}
assert(E.machineRate(a,'ironMine')>baseRate,'advanced automation did not improve machine rate');
assert(E.machinePowerDemand(a,'ironMine')<D.machines.find(x=>x.id==='ironMine').power*1.25,'automation power savings missing');

// Manual click is a one-machine burst; owning many copies must not multiply click income.
const clickOne=E.createInitialState();fill(clickOne);clickOne.machines.ironMine.count=1;clickOne.inventory.ironOre=0;const oneBurst=E.manualClick(clickOne,'ironMine');
const clickMany=E.createInitialState();fill(clickMany);clickMany.machines.ironMine.count=100;clickMany.inventory.ironOre=0;const manyBurst=E.manualClick(clickMany,'ironMine');
assert(Math.abs(oneBurst-manyBurst)<1e-9,'manual click scaled with machine count and bypassed automation balance');

// Damage reservation must prevent overbooking and facilities must work in parallel.
const m=E.createInitialState();fill(m);m.maintenance.facilities.planetWorkshop=1;m.maintenance.facilities.orbitalDrydock=1;m.maintenance.facilities.satelliteHub=1;
m.maintenance.integrity.planet=85;m.maintenance.integrity.orbital=80;m.maintenance.damagedShips.fighter=3;
assert(E.queueRepair(m,'zone','planet',10),'planet repair queue failed');
assert(E.repairAvailableAmount(m,'zone','planet')===5,'queued planet repair was not reserved');
assert(!E.canQueueRepair(m,'zone','planet',10),'zone repair overbooking allowed');
assert(E.queueRepair(m,'ship','fighter',2),'ship repair queue failed');
const planetJob=m.maintenance.repairQueue.find(j=>j.kind==='zone'),shipJob=m.maintenance.repairQueue.find(j=>j.kind==='ship');
assert(planetJob&&shipJob,'parallel repair jobs missing');
assert(Math.abs(planetJob.startedAt-shipJob.startedAt)<1000,'independent facilities were serialized globally');
planetJob.finishAt=Date.now()-1;shipJob.finishAt=Date.now()-1;E.tickMaintenance(m,Date.now());
assert(m.maintenance.integrity.planet===95,'zone integrity repair failed');
assert(m.galaxy.ships.fighter===2&&m.maintenance.damagedShips.fighter===1,'damaged ship repair failed');
assert(m.stats.repairsCompleted===12,'repair statistics incorrect');
assert(m.galaxy.reports.some(r=>r.details?.category==='maintenance'),'maintenance report missing');

// Full battle must create round-by-round report, cargo-limited loot, salvage and damaged pools.
const b=E.createInitialState();fill(b);b.galaxy.ships.dreadnought=8;b.inventory.starFuel=1e9;
const target=b.galaxy.targets[0];target.discovered=true;target.strength=10;target.distance=1;
assert(E.sendFleet(b,target.id,{dreadnought:8}),'battle fleet launch failed');
const mission=b.galaxy.missions[0];E.tick(b,0.1,mission.arrivalAt+1);
assert(mission.status==='returning','battle did not resolve to return phase');
const battleReport=b.galaxy.reports.find(r=>r.details?.category==='battle');
assert(battleReport,'detailed battle report missing');
assert(Array.isArray(battleReport.details.rounds)&&battleReport.details.rounds.length>=1,'round simulation log missing');
assert(battleReport.details.cargo.used<=battleReport.details.cargo.capacity,'loot exceeded surviving cargo');
assert(battleReport.details.operational&&battleReport.details.damaged&&battleReport.details.lost,'fleet split missing from report');
E.tick(b,0.1,mission.returnAt+1);
assert(b.galaxy.missions.length===0,'battle return did not complete');
assert(b.stats.salvageRecovered>=0,'salvage statistic invalid');

// An annihilated fleet cannot magically bring wreckage home.
const z=E.createInitialState();fill(z);z.galaxy.ships.scout=1;z.inventory.starFuel=1e9;const doom=z.galaxy.targets[0];doom.discovered=true;doom.strength=1e12;doom.distance=1;
assert(E.sendFleet(z,doom.id,{scout:1}),'annihilation setup launch failed');const doomed=z.galaxy.missions[0];E.tick(z,.1,doomed.arrivalAt+1);
const doomReport=z.galaxy.reports.find(r=>r.details?.category==='battle');
assert(doomReport.details.cargo.capacity===0,'annihilated fleet retained cargo capacity');
assert(Object.values(doomReport.details.salvage||{}).reduce((x,y)=>x+y,0)===0,'annihilated fleet recovered salvage');

// Raid must damage infrastructure, produce salvage and emit explainable phase data without deleting factories.
const r=E.createInitialState();fill(r);r.galaxy.defenses.turret=200;r.galaxy.defenses.interceptor=100;r.inventory.ammunition=1e9;r.galaxy.threat=3;
const entitiesBefore=Object.keys(r.grid.entities).length;r.galaxy.nextRaidAt=Date.now()-1;E.tick(r,.1,Date.now());
const raidReport=r.galaxy.reports.find(x=>x.details?.category==='raid');
assert(raidReport&&raidReport.details.phases.length===3,'raid phase report missing');
assert(Object.keys(r.grid.entities).length===entitiesBefore,'raid deleted factory entities');
assert(['planet','orbital','satellite'].some(k=>r.maintenance.integrity[k]<100),'raid caused no infrastructure damage');
assert(r.stats.salvageRecovered>0,'raid salvage missing');

// Once finite targets are scanned, Frontier Doctrine must keep producing stronger procedural enemies.
const f=E.createInitialState();fill(f);f.galaxy.targets.forEach(t=>t.discovered=true);f.galaxy.scanCooldownUntil=0;
const frontier=E.scanNextTarget(f);assert(frontier&&frontier.procedural&&frontier.frontierDepth===1,'first procedural frontier target missing');
f.galaxy.scanCooldownUntil=0;frontier.defeated=true;f.galaxy.frontierGenerated=1;
const frontier2=E.scanNextTarget(f);assert(frontier2&&frontier2.frontierDepth===2,'second procedural frontier target missing');
assert(frontier2.strength>frontier.strength&&frontier2.distance>frontier.distance,'frontier scaling did not grow');

// v13 saves must migrate to v15 without losing current 300x300 spatial state.
const old=E.createInitialState();old.version=13;old.coins=4321;old.maintenance=undefined;const migrated=E.normalizeState(JSON.parse(JSON.stringify(old)));
assert(migrated.version===15&&migrated.coins===4321,'v13 to v15 migration failed');
assert(migrated.maintenance.integrity.planet===100&&Array.isArray(migrated.maintenance.repairQueue),'maintenance defaults missing after migration');

console.log('PASS warfront-maintenance: automation V, bounded manual click, repair reservation/parallelism, detailed combat, cargo-limited salvage, raids, frontier scaling and v15 migration');
