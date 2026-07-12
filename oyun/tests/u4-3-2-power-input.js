'use strict';
const assert=require('assert');
const {loadRuntime,decimalEq}=require('./runtime-loader');
const ctx=loadRuntime();
const {Economy:E,Data:D,EconomyNumber:EN}=ctx.Axyon;

function findCell(s,id,type='machine'){
  for(const sec of E.openSectorList(s))
    for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)
      for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)
        if(E.canPlaceAt(s,id,type,x,y))return[x,y];
  return null;
}
function place(s,id,type='machine'){
  const cell=findCell(s,id,type);assert(cell,`no cell for ${id}`);
  const eid=type==='plant'?E.placePlant(s,id,...cell):E.placeMachine(s,id,...cell);
  assert(eid,`placement failed ${id}`);return eid;
}
function tick(s,seconds){for(let i=0;i<seconds*10;i++)E.tick(s,.1,Date.now()+i*100);}

const s=E.createInitialState();
assert.strictEqual(s.firstOrbit.landingReactorActive,false);
assert.strictEqual(s.firstOrbit.landingReactorPower,0);
assert.strictEqual(E.starterFreePlantRemaining(s,'coalGen'),1);
assert(decimalEq(ctx,s.inventory.coal,12),'starter fuel must be finite');

const mine=place(s,'ironMine');
const furnace=place(s,'ironFurnace');
E._u2.setInv(s,'ironOre',20);
const coalAtStart=EN.safe(s.inventory.coal);
tick(s,5);
assert(EN.eq(s.stats.produced.ironOre,0),'unconnected mine produced ore');
assert(EN.eq(s.stats.produced.ironPlate,0),'unconnected furnace produced plates');
assert(EN.eq(s.inventory.coal,coalAtStart),'fuel changed without a connected load');
{const ps=E.entityPowerStatus(s,mine);assert.strictEqual(ps.linked,false);assert.strictEqual(ps.powered,false);assert.strictEqual(ps.ratio,0);}

const plant=place(s,'coalGen','plant');
tick(s,5);
assert(EN.eq(s.stats.produced.ironOre,0),'generator powered an unconnected mine');
assert(EN.eq(s.stats.produced.ironPlate,0),'generator powered an unconnected furnace');
assert(EN.eq(s.inventory.coal,coalAtStart),'unconnected generator burned fuel');

assert(E.addPowerLine(s,plant,mine),'mine power line failed');
tick(s,5);
assert(EN.gt(s.stats.produced.ironOre,0),'connected mine produced no ore');
assert(EN.lt(s.inventory.coal,coalAtStart),'connected generator consumed no coal');
assert(E.entityPowerStatus(s,mine).powered,'connected mine not reported powered');
assert(EN.eq(s.stats.produced.ironPlate,0),'unconnected furnace produced plates while another machine was linked');

assert(E.addPowerLine(s,plant,furnace),'furnace power line failed');
const plateBefore=EN.safe(s.stats.produced.ironPlate);
tick(s,5);
assert(EN.gt(s.stats.produced.ironPlate,plateBefore),'connected furnace produced no plates');

const restored=E.normalizeState(JSON.parse(JSON.stringify(s)));
assert.strictEqual(restored.grid.powerLines.length,2,'power graph links were lost during save/reload');
const restoredBefore=EN.safe(restored.stats.produced.ironPlate);
tick(restored,2);
assert(EN.gt(restored.stats.produced.ironPlate,restoredBefore),'restored connected factory did not produce');

restored.grid.powerLines=restored.grid.powerLines.filter(line=>line.to!==furnace);
const disconnectedBefore=EN.safe(restored.stats.produced.ironPlate);
tick(restored,3);
assert(EN.eq(restored.stats.produced.ironPlate,disconnectedBefore),'furnace kept producing after its power line was removed');
assert(!E.entityPowerStatus(restored,furnace).powered,'disconnected furnace still reported powered');

assert(E.removeEntity(restored,plant),'starter generator removal failed');
assert.strictEqual(E.starterFreePlantRemaining(restored,'coalGen'),1,'starter generator right was not returned');

const dry=E.createInitialState(),dryMine=place(dry,'ironMine'),dryPlant=place(dry,'coalGen','plant');
E._u2.setInv(dry,'coal',0);assert(E.addPowerLine(dry,dryPlant,dryMine));tick(dry,5);
assert(EN.eq(dry.stats.produced.ironOre,0),'fuel-starved generator created energy');
assert.strictEqual(E.entityPowerStatus(dry,dryMine).powered,false);

console.log('PASS U4.3.2 strict power: no generator/line/fuel means zero production; linked fueled networks produce and persist');
