'use strict';
const assert=require('assert');
const {loadRuntime,fillEconomy}=require('./runtime-loader');

let seed=1,clock=1_800_000_000_000;
const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
const math=Object.create(Math);math.random=rnd;
class FakeDate extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
const ctx=loadRuntime({Math:math,Date:FakeDate});
const {Economy:E,Data:D,EconomyNumber:EN}=ctx.Axyon;
const itemIds=Object.keys(D.items);

function runScenario(initialSeed,clockBase,offset){
  seed=initialSeed>>>0;clock=clockBase;
  const s=E.createInitialState();
  fillEconomy(ctx,s,'2e12');
  D.research.forEach(t=>s.researched[t.id]=true);
  D.machines.forEach((d,i)=>{s.machines[d.id].count=(i+offset)%4?2:1;s.machines[d.id].automationLevel=1;s.machines[d.id].hasManager=true;});
  D.powerPlants.forEach(d=>s.plants[d.id].count=3);
  D.ships.forEach(d=>s.galaxy.ships[d.id]=30);
  D.defenses.forEach(d=>s.galaxy.defenses[d.id]=100);
  s.maintenance.facilities={planetWorkshop:5,orbitalDrydock:5,satelliteHub:5};
  s.market.enabled=true;s.market.networkMk=s.market.level=3;s.market.prototypeBuilt=true;s.market.creditEconomyUnlocked=true;
  s.market.foundingContractsCompleted=D.firstOrbit.foundingContracts.map(c=>c.id);
  s.galaxy.satellites.prototypeMarketSatellite=1;s.galaxy.satellites.marketSatellite=8;

  const decimalNonNegative=(v,name)=>assert(EN.finite(v)&&!EN.signed(v).lt(0),`${name} invalid`);
  function invariants(step){
    decimalNonNegative(s.coins,'coins');decimalNonNegative(s.totalEarned,'totalEarned');
    for(const[k,v]of Object.entries(s.inventory)){decimalNonNegative(v,`inventory.${k}`);assert(v instanceof EN.Decimal,`inventory.${k} downgraded at ${step}`);}
    for(const[k,v]of Object.entries(s.stats.produced)){decimalNonNegative(v,`produced.${k}`);assert(v instanceof EN.Decimal,`produced.${k} downgraded at ${step}`);}
    for(const d of D.machines){const m=s.machines[d.id];assert(Number.isFinite(m.count)&&m.count>=0);assert(m.automationLevel>=0&&m.automationLevel<=5);}
    for(const d of D.powerPlants)assert(Number.isFinite(s.plants[d.id].count)&&s.plants[d.id].count>=0);
    for(const d of D.ships){assert(Number.isFinite(s.galaxy.ships[d.id])&&s.galaxy.ships[d.id]>=0);assert(Number.isFinite(s.maintenance.damagedShips[d.id])&&s.maintenance.damagedShips[d.id]>=0);}
    for(const d of D.defenses){assert(Number.isFinite(s.galaxy.defenses[d.id])&&s.galaxy.defenses[d.id]>=0);assert(Number.isFinite(s.maintenance.damagedDefenses[d.id])&&s.maintenance.damagedDefenses[d.id]>=0);}
    for(const z of ['planet','orbital','satellite'])assert(Number.isFinite(s.maintenance.integrity[z])&&s.maintenance.integrity[z]>=0&&s.maintenance.integrity[z]<=100);
    assert(s.galaxy.reports.length<=200);assert(s.researchProgress.queue.length<=E.researchQueueCapacity(s));assert(s.galaxy.missions.length<=30);
    assert(s.maintenance.repairQueue.every(j=>Number.isFinite(j.finishAt)&&j.finishAt>=j.startedAt));assert(s.galaxy.satelliteQueue.length<=250);
  }

  for(let local=0;local<1000;local++){
    const i=local+offset*137;clock+=2500;const action=i%27;
    if(action===0)E.setAutoSellKeep(s,itemIds[i%itemIds.length],[0,25,50,75,100][i%5]);
    if(action===1)E.sellFraction(s,itemIds[i%itemIds.length],.25);
    if(action===2)E.manualClick(s,D.machines[i%D.machines.length].id);
    if(action===3)E.upgradeAutomation(s,D.machines[i%D.machines.length].id);
    if(action===4)E.doUpgradeClass(s,D.machines[i%D.machines.length].id,'machine');
    if(action===5)E.doUpgradeClass(s,D.powerPlants[i%D.powerPlants.length].id,'plant');
    if(action===6)E.upgradeMarket(s);
    if(action===7)E.buildDefense(s,D.defenses[i%D.defenses.length].id,1);
    if(action===8)E.queueShip(s,D.ships[i%D.ships.length].id,1);
    if(action===9&&local%108===0)s.galaxy.nextRaidAt=clock-1;
    if(action===10){const z=['planet','orbital','satellite'][i%3],a=Math.min(5,E.repairAvailableAmount(s,'zone',z));if(a)E.queueRepair(s,'zone',z,a);}
    if(action===11){const d=D.ships[i%D.ships.length],a=Math.min(2,E.repairAvailableAmount(s,'ship',d.id));if(a)E.queueRepair(s,'ship',d.id,a);}
    if(action===12){const d=D.defenses[i%D.defenses.length],a=Math.min(3,E.repairAvailableAmount(s,'defense',d.id));if(a)E.queueRepair(s,'defense',d.id,a);}
    if(action===13)E.upgradeFacility(s,D.repairFacilities[i%D.repairFacilities.length].id);
    if(action===14&&local%216===0){const t=s.galaxy.targets.find(x=>x.discovered&&!x.defeated&&!s.galaxy.missions.some(m=>m.targetId===x.id));if(t)E.sendFleet(s,t.id,{dreadnought:Math.min(5,s.galaxy.ships.dreadnought)});}
    if(action===15){s.galaxy.scanCooldownUntil=0;E.scanNextTarget(s);}
    if(action===16){s.market.nextDispatchAt=clock-1;E.runAutoSell(s);}
    E.tick(s,2.5,clock);if(local%100===0)invariants(local);
  }
  invariants(1000);
  const roundtrip=E.normalizeState(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(roundtrip.version,16);assert(roundtrip.coins instanceof EN.Decimal);assert(roundtrip.inventory.ironOre instanceof EN.Decimal);
}

const seeds=[0xA5C0FFEE,0x13579BDF,0xDEADBEEF];
seeds.forEach((value,i)=>runScenario(value,1_800_000_000_000+i*10_000_000,i));
console.log('PASS stability-fuzz U2: 3,000 deterministic cycles across three Decimal economy/combat/repair scenarios, invariants and v16 roundtrips');
