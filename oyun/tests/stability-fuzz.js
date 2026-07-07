const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
let seed=0xA5C0FFEE;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
const math=Object.create(Math);math.random=rnd;
let clock=1_800_000_000_000;
class FakeDate extends Date{constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
const ctx={console,Date:FakeDate,Math:math,setTimeout,clearTimeout};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['data/feature-flags.js','vendor/break_eternity/break_eternity.min.js','src/core/economy-number.js','src/core/lossless-json.js','src/services/save-migrator-v16.js','data/canonical/game-data.v4.4.final.js','src/core/canonical-data-loader.js','src/core/numbers.js','data/config.js','src/core/economy.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const {Economy:E,Data:D}=ctx.Axyon,assert=(x,m)=>{if(!x)throw new Error(m)};
const s=E.createInitialState();
s.coins=2e12;D.research.forEach(t=>s.researched[t.id]=true);Object.keys(D.items).forEach(k=>s.inventory[k]=Math.min(25000,D.items[k].cap*20));
D.machines.forEach((d,i)=>{s.machines[d.id].count=i%4?2:1;s.machines[d.id].automationLevel=1;s.machines[d.id].hasManager=true;});
D.powerPlants.forEach(d=>s.plants[d.id].count=3);
D.ships.forEach(d=>s.galaxy.ships[d.id]=30);D.defenses.forEach(d=>s.galaxy.defenses[d.id]=100);
s.maintenance.facilities={planetWorkshop:5,orbitalDrydock:5,satelliteHub:5};s.market.enabled=true;
const finiteNonNegative=(v,name)=>assert(Number.isFinite(v)&&v>=-1e-7,`${name} invalid: ${v}`);
function invariants(step){
  finiteNonNegative(s.coins,'coins');finiteNonNegative(s.totalEarned,'totalEarned');
  for(const [k,v] of Object.entries(s.inventory))finiteNonNegative(v,`inventory.${k}`);
  for(const d of D.machines){const m=s.machines[d.id];finiteNonNegative(m.count,`machine.${d.id}.count`);assert(m.automationLevel>=0&&m.automationLevel<=5,`automation range ${d.id}`);}
  for(const d of D.powerPlants)finiteNonNegative(s.plants[d.id].count,`plant.${d.id}.count`);
  for(const d of D.ships){finiteNonNegative(s.galaxy.ships[d.id],`ship.${d.id}`);finiteNonNegative(s.maintenance.damagedShips[d.id],`damaged ship.${d.id}`);}
  for(const d of D.defenses){finiteNonNegative(s.galaxy.defenses[d.id],`defense.${d.id}`);finiteNonNegative(s.maintenance.damagedDefenses[d.id],`damaged defense.${d.id}`);}
  for(const z of ['planet','orbital','satellite'])assert(Number.isFinite(s.maintenance.integrity[z])&&s.maintenance.integrity[z]>=0&&s.maintenance.integrity[z]<=100,`integrity ${z}`);
  assert(s.galaxy.reports.length<=200,'report retention exceeded');
  assert(s.researchProgress.queue.length<=E.researchQueueCapacity(s),'research queue overflow');
  assert(s.galaxy.missions.length<=30,'mission retention exceeded');
  assert(s.maintenance.repairQueue.every(j=>Number.isFinite(j.finishAt)&&j.finishAt>=j.startedAt),`repair timestamp invalid at ${step}`);
}
for(let i=0;i<12000;i++){
  clock+=2500;const action=i%23;
  if(action===0){const id=D.items[Object.keys(D.items)[i%Object.keys(D.items).length]];void id;}
  if(action===1)E.sellFraction(s,Object.keys(D.items)[i%Object.keys(D.items).length],.25);
  if(action===2){const d=D.machines[i%D.machines.length];E.manualClick(s,d.id);}
  if(action===3){const d=D.machines[i%D.machines.length];E.upgradeAutomation(s,d.id);}
  if(action===4){const d=D.machines[i%D.machines.length];E.doUpgradeClass(s,d.id,'machine');}
  if(action===5){const d=D.powerPlants[i%D.powerPlants.length];E.doUpgradeClass(s,d.id,'plant');}
  if(action===6)E.upgradeMarket(s);
  if(action===7){const d=D.defenses[i%D.defenses.length];E.buildDefense(s,d.id,1);}
  if(action===8){const d=D.ships[i%D.ships.length];E.queueShip(s,d.id,1);}
  if(action===9&&i%92===0)s.galaxy.nextRaidAt=clock-1;
  if(action===10){const z=['planet','orbital','satellite'][i%3],a=Math.min(5,E.repairAvailableAmount(s,'zone',z));if(a)E.queueRepair(s,'zone',z,a);}
  if(action===11){const d=D.ships[i%D.ships.length],a=Math.min(2,E.repairAvailableAmount(s,'ship',d.id));if(a)E.queueRepair(s,'ship',d.id,a);}
  if(action===12){const d=D.defenses[i%D.defenses.length],a=Math.min(3,E.repairAvailableAmount(s,'defense',d.id));if(a)E.queueRepair(s,'defense',d.id,a);}
  if(action===13){const f=D.repairFacilities[i%D.repairFacilities.length];E.upgradeFacility(s,f.id);}
  if(action===14&&i%230===0){const t=s.galaxy.targets.find(x=>x.discovered&&!x.defeated&&!s.galaxy.missions.some(m=>m.targetId===x.id));if(t){const sel={dreadnought:Math.min(5,s.galaxy.ships.dreadnought)};E.sendFleet(s,t.id,sel);}}
  if(action===15){s.galaxy.scanCooldownUntil=0;E.scanNextTarget(s);}
  E.tick(s,2.5,clock);
  if(i%100===0)invariants(i);
}
invariants(12000);
const roundtrip=E.normalizeState(JSON.parse(JSON.stringify(s)));assert(roundtrip.version===E.SAVE_VERSION,'roundtrip schema mismatch');
console.log('PASS stability-fuzz: 12,000 deterministic economy/combat/repair cycles, numeric invariants, queues and save roundtrip');
