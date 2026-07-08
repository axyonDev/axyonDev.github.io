'use strict';
const assert=require('assert');
const {loadRuntime,memoryStorage}=require('./runtime-loader');
const localStorage=memoryStorage(),ctx=loadRuntime({localStorage,saveService:true});
const {Economy:E,Data:D,SaveService:S,EconomyNumber:EN}=ctx.Axyon;
const findCell=(s,id)=>{for(const sec of E.openSectorList(s))for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)if(E.canPlaceAt(s,id,'machine',x,y))return[x,y];return null;};

// True reset: no prebuilt/active machine remains, but seven manual free rights survive.
assert(S.createProfile('Groundfront Test').ok);let s=S.load();
assert.strictEqual(Object.keys(s.grid.entities).length,0);assert.strictEqual(E.machineCountTotal(s),0);assert.strictEqual(s.galaxy.nextRaidAt,0);
const starterIds=Object.keys(D.firstOrbit.starterPackage.machines);assert.strictEqual(starterIds.length,7);
for(const id of starterIds){assert.strictEqual(E.starterFreeRemaining(s,id),1);assert.deepStrictEqual(Object.keys(E.buildRequirements(s,id)),[]);}
const cell=findCell(s,'ironMine');assert(cell&&E.placeMachine(s,'ironMine',...cell));assert.strictEqual(E.starterFreeRemaining(s,'ironMine'),0);assert(s.galaxy.nextRaidAt>Date.now());
s.inventory.ironOre=EN.safe(999);assert(S.save(s));s=S.resetCurrent({theme:'dark'});assert.strictEqual(Object.keys(s.grid.entities).length,0);assert.strictEqual(E.machineCountTotal(s),0);assert(EN.eq(s.inventory.ironOre,0));assert.strictEqual(E.starterFreeRemaining(s,'ironMine'),1);assert.strictEqual(s.galaxy.nextRaidAt,0);assert(S.save(s));assert.strictEqual(Object.keys(S.load().grid.entities).length,0,'empty reset did not survive reload');

// Ground phase: no alien/space warning before First Orbit; real loss changes state.
const ground=E.createInitialState();const gcell=findCell(ground,'ironMine');assert(gcell&&E.placeMachine(ground,'ironMine',...gcell));ground.inventory.ironOre=EN.safe(1000);ground.galaxy.groundThreatLevel=8;ground.galaxy.nextRaidAt=Date.now()-1;ground.maintenance.integrity.planet=100;E.tick(ground,.1,Date.now());
assert.strictEqual(E.threatPhase(ground),'ground');assert(!ground.galaxy.reports.some(r=>/Uzaylı|yörünge izi/i.test(r.title)&&r.details?.phase!=='space'));
const groundReport=ground.galaxy.reports.find(r=>r.details?.category==='ground-raid');assert(groundReport,'ground threat produced no real report');assert(ground.stats.raidsWon+ground.stats.raidsLost===1);if(groundReport.details.outcome==='defeat')assert(ground.maintenance.integrity.planet<100||EN.lt(ground.inventory.ironOre,1000));

// Orbit gate: space threat starts only when the first orbital asset becomes operational.
const orbit=E.createInitialState();assert.strictEqual(E.spaceThreatUnlocked(orbit),false);assert.strictEqual(orbit.galaxy.nextRaidAt,0);orbit.market.prototypeBuilt=true;orbit.galaxy.satellites.prototypeMarketSatellite=1;E.initializeThreatState(orbit,Date.now());assert.strictEqual(E.threatPhase(orbit),'space');assert(orbit.galaxy.nextRaidAt>Date.now());assert(orbit.galaxy.reports.some(r=>r.details?.phase==='space'&&/yörünge izi/i.test(r.title)));

console.log('PASS U4.3.1: empty-map reset, manual free starter deployment, ground threats and First-Orbit space gate');
